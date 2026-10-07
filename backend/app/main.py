import logging
import time
import threading
from collections import defaultdict, deque
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from .database.database import engine
from .core.config import settings
from .routers import auth, documents, consent, verification, users, issuers, events

app = FastAPI(title='CredVault', version='2.0.0', description='Issuer-signed credentials with server-enforced selective disclosure')
for module in (auth, documents, consent, verification, users, issuers, events):
    app.include_router(module.router)

attempts = defaultdict(deque)
rate_lock = threading.Lock()

@app.middleware('http')
async def security(request: Request, call_next):
    path = request.url.path
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin = request.headers.get('origin')
        if origin and origin != settings.APP_ORIGIN:
            return JSONResponse({'detail':'Untrusted request origin'}, status_code=403)
        if request.headers.get('sec-fetch-site') == 'cross-site':
            return JSONResponse({'detail':'Cross-site mutation blocked'}, status_code=403)
        # Login/reset CSRF and body limits also apply before authentication.
        try:
            if int(request.headers.get('content-length','0')) > 15000000:
                return JSONResponse({'detail':'Request exceeds 15 MB'}, status_code=413)
        except ValueError:
            return JSONResponse({'detail':'Invalid Content-Length'}, status_code=400)
    sensitive = path.startswith('/api/v1/auth/') and request.method == 'POST'
    sensitive = sensitive or path in ('/api/v1/oauth/token', '/api/v1/verification/discover', '/api/v1/owners/confirm') or (path == '/api/v1/verification/requests' and request.method == 'POST')
    if sensitive:
        key = (request.client.host if request.client else 'local', path)
        limit = 20 if '/auth/' in path else 120
        with rate_lock:
            now = time.monotonic()
            if len(attempts) > 10000:
                for old in [k for k,v in attempts.items() if not v or v[-1] < now-60]:
                    del attempts[old]
            window = attempts[key]
            while window and window[0] < now-60:
                window.popleft()
            if len(window) >= limit:
                return JSONResponse({'detail':'Too many attempts. Try again in one minute.'}, status_code=429, headers={'Retry-After':'60'})
            window.append(now)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Frame-Options'] = 'DENY'
    if settings.SECURE_COOKIES:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response

@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    # Pydantic's default error includes submitted passwords and private values.
    errors = [{'field': '.'.join(str(x) for x in e['loc'][1:]), 'message':e['msg']} for e in exc.errors()]
    return JSONResponse({'detail': '; '.join(e['field'] + ': ' + e['message'] for e in errors), 'errors':errors}, status_code=422)

@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    logging.getLogger('credvault').error('Database operation failed (%s)', type(exc).__name__)
    return JSONResponse({'detail':'The database operation could not be completed. Please retry.'}, status_code=503)

@app.get('/health')
def health():
    with engine.connect() as connection:
        connection.execute(text('SELECT 1 FROM cv_users LIMIT 1'))
    return {'status':'ok', 'service':'credvault', 'version':'2.0.0', 'database':engine.dialect.name}
