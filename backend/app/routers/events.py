import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from ..database.database import SessionLocal
from ..core.dependencies import current, browser
from ..core.config import settings
from ..models import LiveRevision

router = APIRouter(prefix='/api/v1', tags=['Live updates'])

def snapshot(request):
    # No request-wide transaction/lock: a stream must never block mutations.
    with SessionLocal() as db:
        p = browser(current(request, db))
        row = db.get(LiveRevision, p.user.id)
        return p.user.id, row.revision if row else 0

@router.get('/events')
async def events(request: Request):
    origin = request.headers.get('origin')
    if (origin and origin != settings.APP_ORIGIN) or request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Untrusted event origin')
    initial_user, _ = await run_in_threadpool(snapshot, request)
    async def stream():
        previous = None
        ticks = 0
        yield 'retry: 2000\n\n'
        while not await request.is_disconnected():
            try:
                user_id, revision = await run_in_threadpool(snapshot, request)
            except HTTPException:
                yield 'event: session-expired\ndata: {}\n\n'
                return
            if user_id != initial_user:
                return
            if revision != previous:
                # Always refetch on connect/reconnect, including missed events.
                yield 'event: change\ndata: ' + json.dumps({'revision': revision}) + '\n\n'
                previous = revision
            elif ticks % 15 == 0:
                yield ': keepalive\n\n'
            ticks += 1
            await asyncio.sleep(1)
    return StreamingResponse(stream(), media_type='text/event-stream',
        headers={'Cache-Control':'no-store', 'X-Accel-Buffering':'no'})
