import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .database.database import engine
from .routers import auth, users, issuers, documents, consent, verification, audit
from .core.responses import WrappedResponse
from .core.exceptions import setup_exception_handlers

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CredVault API server starting up...")
    yield
    logger.info("CredVault API server shutting down...")
    await engine.dispose()

app = FastAPI(
    title="CredVault API",
    description="Local Prototype Backend for Decentralized Credential Vault",
    version="0.3.0",
    lifespan=lifespan,
    default_response_class=WrappedResponse
)

# Apply global exception handling (Section 39)
setup_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(issuers.router)
app.include_router(issuers.issuer_router)
app.include_router(documents.router)
app.include_router(documents.issuer_doc_router)
app.include_router(consent.router)
app.include_router(verification.router)
app.include_router(audit.router)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "credvault-api",
        "version": "1.0.0"
    }

@app.get("/")
def root():
    return {
        "name": "CredVault API",
        "version": "1.0.0",
        "environment": "local",
        "docs": "/docs"
    }
