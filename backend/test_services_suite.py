import asyncio
import sys
sys.path.insert(0, "backend")

from app.core.database import MEMORY_STORE, ADMIN_WS_ID, ADMIN_USER_ID
from app.services.scenario_service import ScenarioService
from app.services.run_service import RunService
from app.services.comparison_service import ComparisonService
from app.services.report_service import ReportService
from app.services.import_service import ImportService
from app.schemas.scenario_schemas import ScenarioCreate, PRESETS
from app.simulation.replications import run_simulation

class MockDB:
    def __getattr__(self, name):
        class MockCol:
            async def insert_one(self, *a, **k): raise Exception("offline")
            async def find_one(self, *a, **k): return None
            async def count_documents(self, *a, **k): return 0
            async def update_one(self, *a, **k): raise Exception("offline")
            async def delete_many(self, *a, **k): return None
            def find(self, *a, **k):
                class MockCursor:
                    def sort(self, *a, **k): return self
                    def skip(self, *a, **k): return self
                    def limit(self, *a, **k): return self
                    async def to_list(self, *a, **k): return []
                return MockCursor()
        return MockCol()

async def run_full_suite():
    print("==================================================")
    print("STARTING DIRECT SERVICES & ENGINE VERIFICATION")
    print("==================================================")
    db = MockDB()

    # 1. Presets
    assert len(PRESETS) == 4
    print(f"✓ Presets verified: {list(PRESETS.keys())}")

    # 2. ScenarioService (CRUD)
    sc_svc = ScenarioService(db)
    body = ScenarioCreate(
        name="Automated Test Bank Branch",
        description="Testing complete workflow",
        service_type="bank_counter",
        config={
            "servers": 3,
            "horizon_minutes": 120,
            "warm_up_minutes": 10,
            "replications": 5,
            "seed": 42,
            "queue_discipline": "FIFO",
            "arrival": {"distribution": "exponential", "mean_interarrival": 3.0},
            "service": {"distribution": "exponential", "mean": 6.0},
        }
    )
    scen = await sc_svc.create(ADMIN_WS_ID, ADMIN_USER_ID, body)
    scen_id = scen["id"]
    print(f"✓ ScenarioService.create: ID {scen_id}, status '{scen['status']}'")

    scen_read = await sc_svc.get(scen_id, ADMIN_WS_ID)
    assert scen_read["id"] == scen_id
    print(f"✓ ScenarioService.get: read successfully")

    from app.schemas.scenario_schemas import ScenarioUpdate
    scen_updated = await sc_svc.update(scen_id, ADMIN_WS_ID, ScenarioUpdate(description="Updated by test"))
    assert scen_updated["description"] == "Updated by test"
    print(f"✓ ScenarioService.update: updated description successfully")

    val_res = await sc_svc.validate(scen_id, ADMIN_WS_ID)
    assert val_res["status"] == "ready"
    print(f"✓ ScenarioService.validate: scenario validated as '{val_res['status']}'")

    dup_scen = await sc_svc.duplicate(scen_id, ADMIN_WS_ID, "Automated Test Bank Branch (copy)")
    assert dup_scen["id"] != scen_id
    print(f"✓ ScenarioService.duplicate: duplicated scenario ID {dup_scen['id']}")

    # 3. CSV Ingestion (ImportService)
    imp_svc = ImportService(db)
    csv_bytes = b"arrival_timestamp,service_duration\n1.2,4.5\n2.8,3.8\n4.5,6.2\n6.1,2.9\n8.4,5.1\n"
    imp_res = await imp_svc.process_csv_upload(
        workspace_id=ADMIN_WS_ID,
        scenario_id=scen_id,
        file_bytes=csv_bytes,
        filename="sample_test.csv"
    )
    assert imp_res["status"] == "validated"
    assert imp_res["row_count"] == 5
    print(f"✓ ImportService.process_csv_upload: status '{imp_res['status']}', {imp_res['row_count']} rows")

    imp_get = await imp_svc.get_import(imp_res["id"], ADMIN_WS_ID)
    assert imp_get["id"] == imp_res["id"]
    print(f"✓ ImportService.get_import: retrieved successfully")

    # 4. Simulation Execution (RunService & SimPy Engine)
    run_svc = RunService(db)
    run = await run_svc.create_run(ADMIN_WS_ID, ADMIN_USER_ID, scen_id)
    run_id = run["id"]
    print(f"✓ RunService.create_run: Run #{run_id[:8]} created")

    # Execute inline simulation
    await run_svc._run_simulation_inline(run_id, ADMIN_WS_ID, scen["config"])
    run_done = await run_svc.get_run(run_id, ADMIN_WS_ID)
    assert run_done["status"] == "completed"
    assert run_done["progress"] == 100
    print(f"✓ RunService inline SimPy execution: status '{run_done['status']}', progress {run_done['progress']}%")

    metrics = await run_svc.get_run_metrics(run_id, ADMIN_WS_ID)
    assert "avg_waiting_time" in metrics
    assert "replication_summaries" in metrics
    print(f"✓ RunService.get_run_metrics: avg_wait = {metrics['avg_waiting_time']:.2f} min, avg_queue = {metrics['avg_queue_length']:.2f}, replications = {len(metrics['replication_summaries'])}")

    # 5. Second Run & ComparisonService
    await sc_svc.validate(dup_scen["id"], ADMIN_WS_ID)
    run2 = await run_svc.create_run(ADMIN_WS_ID, ADMIN_USER_ID, dup_scen["id"])
    run2_id = run2["id"]
    await run_svc._run_simulation_inline(run2_id, ADMIN_WS_ID, dup_scen["config"])

    comp_svc = ComparisonService(db)
    comp_res = await comp_svc.compare_runs([run_id, run2_id], ADMIN_WS_ID)
    assert len(comp_res["comparison"]) == 2
    print(f"✓ ComparisonService.compare_runs: successfully compared {len(comp_res['comparison'])} runs")

    sens_res = await comp_svc.run_sensitivity(scen_id, ADMIN_WS_ID, "servers", [1.0, 2.0, 3.0, 4.0])
    assert len(sens_res["results"]) == 4
    print(f"✓ ComparisonService.run_sensitivity: evaluated {len(sens_res['results'])} sensitivity points")

    # 6. Report Generation (ReportService)
    rep_svc = ReportService(db)
    pdf_rep = await rep_svc.generate_report(run_id, ADMIN_WS_ID, "pdf")
    assert pdf_rep["status"] == "completed"
    print(f"✓ ReportService.generate_report (PDF): ID {pdf_rep['id']}, status '{pdf_rep['status']}'")

    csv_rep = await rep_svc.generate_report(run_id, ADMIN_WS_ID, "csv")
    assert csv_rep["status"] == "completed"
    print(f"✓ ReportService.generate_report (CSV): ID {csv_rep['id']}, status '{csv_rep['status']}'")

    csv_file_path = await rep_svc.get_report_file_path(csv_rep["id"], ADMIN_WS_ID)
    import os
    assert os.path.exists(csv_file_path)
    print(f"✓ Report file verified on disk: {csv_file_path}")

    # 7. Delete Scenario (CRUD: Delete)
    del_res = await sc_svc.delete(dup_scen["id"], ADMIN_WS_ID)
    assert del_res["deleted"] is True
    print(f"✓ ScenarioService.delete: scenario deleted successfully")

    print("==================================================")
    print("ALL SERVICES, CALCULATIONS & FLOWS VERIFIED 100%!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_full_suite())
