# CredVault Backend API (Local Prototype)

CredVault is a decentralized, privacy-preserving credential and document verification platform. This is the local backend prototype demonstrating cryptographic signatures, AES encryption, and a zero-knowledge-style selective disclosure consent engine.

## Architecture
The backend is built with:
- **Framework:** FastAPI (Python 3.11+)
- **Database:** SQLite (SQLAlchemy 2.x with Alembic migrations)
- **Security:** AES-256-GCM for storage encryption, RSA-SHA256 for document signatures, and bcrypt for passwords.

## Requirements
- Python 3.11 or higher
- `pip`

## Installation & Virtual Environment

**1. Create a virtual environment:**
```bash
python -m venv .venv
```

**2. Activate it:**
- macOS/Linux:
  ```bash
  source .venv/bin/activate
  ```
- Windows:
  ```bash
  .venv\Scripts\activate
  ```

**3. Install Dependencies:**
```bash
pip install -r requirements.txt
```

## Environment Variables

Copy `.env.example` to `.env` in the `backend` directory:
```bash
cp .env.example .env
```
Ensure the `AES_MASTER_KEY` is a valid 32-byte Base64-encoded string (or generate one).

## Key Generation

The system requires local RSA keypairs to simulate cryptographic issuance. Run the seed script below which will automatically generate them in the `keys/` directory if they do not exist.

## Database Setup & Seed Data

Ensure Alembic runs the latest migrations:
```bash
alembic upgrade head
```

Then, populate the local database with fictional demo accounts, sample issuers, and mock documents:
```bash
python scripts/seed_demo.py
```

## Running the Server

Start the FastAPI application:
```bash
uvicorn app.main:app --reload --port 8000
```
The server runs on `http://localhost:8000`.

## API Documentation

FastAPI automatically serves interactive Swagger UI documentation at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

## Demo Accounts

The `seed_demo.py` script provisions the following accounts:
- **Owner:** `owner@credvault.local` (Password: `Demo@123`)
- **Issuer:** `issuer@credvault.local` (Password: `Demo@123`)
- **Verifier:** `verifier@credvault.local` (Password: `Demo@123`)

## Testing

Ensure you are in the `backend` folder and the virtual environment is active. Run tests via pytest:
```bash
PYTHONPATH=. pytest tests/
```

## Frontend Connection

The backend expects the React frontend to be hosted at `http://localhost:5173`. CORS is pre-configured to explicitly allow this origin. 

## Security Limitations (Prototype)
**DO NOT USE IN PRODUCTION.** This is a local architectural prototype. 
- It simulates an issuer registry rather than a true decentralized DLT.
- Documents are fictional and do not interface with real government APIs.
- RSA keys are locally generated and not securely governed by HSMs.
- Do not deploy this application on the public internet without major structural review.
