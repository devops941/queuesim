"""
API integration tests for Module 02-03 — Scenario CRUD & Validation.
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE = "/api/v1"

VALID_CONFIG = {
    "servers": 2,
    "horizon_minutes": 240,
    "warm_up_minutes": 10,
    "replications": 5,
    "seed": 42,
    "queue_discipline": "FIFO",
    "arrival": {"distribution": "exponential", "mean_interarrival": 4.0},
    "service": {"distribution": "exponential", "mean": 6.0},
}


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def auth_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        reg = await ac.post(f"{BASE}/auth/register", json={
            "email": "scenario_test@example.com", "password": "Sc@12345", "display_name": "ScTest"
        })
        token = reg.json()["access_token"]
        me = await ac.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
        ws_id = me.json()["workspaces"][0]["id"]
        ac.headers.update({"Authorization": f"Bearer {token}"})
        ac.state = type("S", (), {"workspace_id": ws_id})()
        yield ac


@pytest.mark.asyncio
async def test_create_scenario(auth_client):
    res = await auth_client.post(
        f"{BASE}/scenarios",
        json={"name": "Test Scenario", "config": VALID_CONFIG},
        params={"workspace_id": auth_client.state.workspace_id},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Scenario"
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_list_scenarios(auth_client):
    res = await auth_client.get(f"{BASE}/scenarios", params={"workspace_id": auth_client.state.workspace_id})
    assert res.status_code == 200
    assert "data" in res.json()
    assert "meta" in res.json()


@pytest.mark.asyncio
async def test_validate_scenario(auth_client):
    create = await auth_client.post(
        f"{BASE}/scenarios",
        json={"name": "Validate Me", "config": VALID_CONFIG},
        params={"workspace_id": auth_client.state.workspace_id},
    )
    sid = create.json()["id"]
    res = await auth_client.post(
        f"{BASE}/scenarios/{sid}/validate",
        params={"workspace_id": auth_client.state.workspace_id},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_invalid_config_rejected(auth_client):
    bad_config = {**VALID_CONFIG, "servers": 0}
    res = await auth_client.post(
        f"{BASE}/scenarios",
        json={"name": "Bad Config", "config": bad_config},
        params={"workspace_id": auth_client.state.workspace_id},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_warm_up_gt_horizon_rejected(auth_client):
    bad = {**VALID_CONFIG, "warm_up_minutes": 500, "horizon_minutes": 100}
    res = await auth_client.post(
        f"{BASE}/scenarios",
        json={"name": "Bad Warmup", "config": bad},
        params={"workspace_id": auth_client.state.workspace_id},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_scenario(auth_client):
    create = await auth_client.post(
        f"{BASE}/scenarios",
        json={"name": "Original", "config": VALID_CONFIG},
        params={"workspace_id": auth_client.state.workspace_id},
    )
    sid = create.json()["id"]
    res = await auth_client.post(
        f"{BASE}/scenarios/{sid}/duplicate",
        params={"workspace_id": auth_client.state.workspace_id, "new_name": "Copy of Original"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Copy of Original"
    assert res.json()["status"] == "draft"
