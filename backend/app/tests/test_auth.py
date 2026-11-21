"""
API integration tests for Module 01 — Authentication & Workspace.
Run: pytest app/tests/ -v
Requires a running MongoDB at MONGODB_URI (or mock via mongomock).
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE = "/api/v1"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_register_success(client):
    res = await client.post(f"{BASE}/auth/register", json={
        "email": "test_reg@example.com",
        "password": "Test@1234",
        "display_name": "Test User",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "Test@1234", "display_name": "Dup"}
    await client.post(f"{BASE}/auth/register", json=payload)
    res = await client.post(f"{BASE}/auth/register", json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post(f"{BASE}/auth/register", json={
        "email": "login_test@example.com", "password": "Login@1234", "display_name": "Login"
    })
    res = await client.post(f"{BASE}/auth/login", json={
        "email": "login_test@example.com", "password": "Login@1234"
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post(f"{BASE}/auth/register", json={
        "email": "badpw@example.com", "password": "Correct@1234", "display_name": "Bad"
    })
    res = await client.post(f"{BASE}/auth/login", json={
        "email": "badpw@example.com", "password": "Wrong@1234"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    res = await client.get(f"{BASE}/auth/me")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_me_authenticated(client):
    reg = await client.post(f"{BASE}/auth/register", json={
        "email": "me_test@example.com", "password": "Me@12345", "display_name": "MeUser"
    })
    token = reg.json()["access_token"]
    res = await client.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == "me_test@example.com"
    assert len(data["workspaces"]) >= 1


@pytest.mark.asyncio
async def test_refresh_token(client):
    reg = await client.post(f"{BASE}/auth/register", json={
        "email": "refresh_test@example.com", "password": "Ref@12345", "display_name": "Refresh"
    })
    refresh = reg.json()["refresh_token"]
    res = await client.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_workspace_isolation(client):
    """User A cannot access User B's data by guessing workspace_id."""
    reg_a = await client.post(f"{BASE}/auth/register", json={
        "email": "user_a@example.com", "password": "A@123456", "display_name": "UserA"
    })
    reg_b = await client.post(f"{BASE}/auth/register", json={
        "email": "user_b@example.com", "password": "B@123456", "display_name": "UserB"
    })
    token_a = reg_a.json()["access_token"]
    me_b = await client.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {reg_b.json()['access_token']}"})
    ws_b = me_b.json()["workspaces"][0]["id"]

    # User A tries to list scenarios in User B's workspace
    res = await client.get(
        f"{BASE}/scenarios", params={"workspace_id": ws_b},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    # Should be 403 (no membership in that workspace)
    assert res.status_code == 403
