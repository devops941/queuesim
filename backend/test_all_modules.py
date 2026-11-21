import asyncio
import sys
sys.path.insert(0, "backend")

# Disable lifespan for pure API test
from app.main import app
app.router.lifespan_context = None

from httpx import AsyncClient, ASGITransport
from app.core.security import create_access_token

async def test_all():
    print("STARTING TEST...", flush=True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = create_access_token({"sub": "000000000000000000000001", "role": "admin"})
        headers = {"Authorization": f"Bearer {token}"}
        print("1. Token generated", flush=True)

        res = await client.get("/api/v1/scenarios/presets", headers=headers)
        print("2. Presets status:", res.status_code, len(res.json().get("data", [])), flush=True)

        res = await client.get("/api/v1/admin/system-parameters", headers=headers)
        print("3. Admin sys params status:", res.status_code, res.json(), flush=True)

        res = await client.get("/api/v1/analytics/dashboard", headers=headers)
        print("4. Analytics dashboard status:", res.status_code, res.json(), flush=True)

        res = await client.get("/api/v1/admin/health", headers=headers)
        print("5. Admin health status:", res.status_code, res.json().get("status"), flush=True)

        # Create scenario
        scen_payload = {
            "name": "Integration Test Bank Branch",
            "description": "Automated verification scenario",
            "service_type": "bank_counter",
            "config": {
                "servers": 3,
                "horizon_minutes": 120,
                "warm_up_minutes": 10,
                "replications": 5,
                "seed": 42,
                "queue_discipline": "FIFO",
                "arrival": {"distribution": "exponential", "mean_interarrival": 3.0},
                "service": {"distribution": "exponential", "mean": 6.0},
            },
        }
        res = await client.post("/api/v1/scenarios", json=scen_payload, headers=headers)
        print("6. Scenario create status:", res.status_code, res.json().get("id"), flush=True)
        scen_id = res.json()["id"]

        # Run simulation
        res = await client.post(f"/api/v1/scenarios/{scen_id}/runs", json={}, headers=headers)
        print("7. Run create status:", res.status_code, res.json().get("id"), flush=True)
        run_id = res.json()["id"]

        # Wait for run
        for _ in range(15):
            await asyncio.sleep(0.2)
            res = await client.get(f"/api/v1/runs/{run_id}", headers=headers)
            if res.json().get("status") in ["completed", "failed"]:
                break
        print("8. Run status:", res.json().get("status"), flush=True)

        # Run metrics
        res = await client.get(f"/api/v1/runs/{run_id}/metrics", headers=headers)
        print("9. Metrics status:", res.status_code, "avg_wait:", res.json().get("avg_waiting_time"), flush=True)

        # CSV upload
        csv_bytes = b"arrival_timestamp,service_duration\n1.0,4.0\n2.5,3.5\n4.2,5.0\n"
        res = await client.post(
            "/api/v1/imports",
            files={"file": ("test.csv", csv_bytes, "text/csv")},
            data={"scenario_id": scen_id},
            headers=headers
        )
        print("10. CSV import status:", res.status_code, res.json().get("status"), flush=True)

        # Report create
        res = await client.post("/api/v1/reports", json={"run_id": run_id, "workspace_id": "000000000000000000000002", "format": "csv"}, headers=headers)
        print("11. Report status:", res.status_code, res.json().get("id"), flush=True)

    print("ALL 11 END-TO-END STEPS SUCCEEDED!", flush=True)

if __name__ == "__main__":
    asyncio.run(test_all())
