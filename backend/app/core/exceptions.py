from fastapi import Request, FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

def setup_exception_handlers(app: FastAPI):
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail = str(exc.detail).lower()
        error_code = "API_ERROR"
        
        # Base mappings
        if exc.status_code == 404:
            error_code = "NOT_FOUND"
        elif exc.status_code == 401:
            error_code = "AUTHENTICATION_ERROR"
        elif exc.status_code == 403:
            error_code = "AUTHORIZATION_ERROR"
        elif exc.status_code == 400:
            error_code = "BAD_REQUEST"
        elif exc.status_code == 409:
            error_code = "CONFLICT"
            
        # Specific semantic mappings based on Section 39
        if "document not found" in detail:
            error_code = "DOCUMENT_NOT_FOUND"
        elif "issuer not found" in detail or "issuer profile not found" in detail:
            error_code = "ISSUER_NOT_FOUND"
        elif "signature validation failed" in detail or "invalid signature" in detail:
            error_code = "INVALID_SIGNATURE"
        elif "integrity validation failed" in detail or "integrity failure" in detail:
            error_code = "INTEGRITY_FAILURE"
        elif "revoked" in detail:
            error_code = "REVOKED_DOCUMENT"
        elif "consent rule not found" in detail or "invalid consent rule" in detail:
            error_code = "INVALID_CONSENT_RULE"
        elif "verification request not found" in detail or "request is not approved" in detail:
            error_code = "INVALID_VERIFICATION_REQUEST"
        elif "invalid json payload" in detail or "upload error" in detail:
            error_code = "FILE_UPLOAD_ERROR"
        elif "forbidden" in detail or "can only revoke" in detail:
            error_code = "AUTHORIZATION_ERROR"
        elif "incorrect username" in detail or "validate credentials" in detail:
            error_code = "AUTHENTICATION_ERROR"
            
        # Log the error (but never log sensitive fields or payloads by default)
        logger.warning(f"HTTP Exception: {exc.status_code} - {error_code} - {exc.detail}")
            
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": error_code,
                    "message": str(exc.detail)
                }
            }
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation Error: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request parameters or payload",
                    "details": exc.errors()
                }
            }
        )
        
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        # Do not expose Python stack traces to the client
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred"
                }
            }
        )
