import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
        assert response.status_code == 200
        data = response.json()["data"]
        assert "name" in data
        assert data["name"] == "CredVault API"
        assert "version" in data
        assert data["version"] == "1.0.0"
        assert "environment" in data
        assert data["environment"] == "local"
        assert "docs" in data
        assert data["docs"] == "/docs"

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] == "ok"
        assert data["service"] == "credvault-api"
        assert data["version"] == "1.0.0"
