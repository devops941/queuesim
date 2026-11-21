"""
Run management service: create, track, and retrieve simulation runs.
"""
from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.errors import AppError
from app.repositories.run_repository import RunRepository
from app.repositories.scenario_repository import ScenarioRepository


def _serialize_run(doc: dict) -> dict:
    run_id = doc.get("id") or str(doc["_id"])
    c_at = doc.get("created_at")
    comp_at = doc.get("completed_at")
    return {
        "id": run_id,
        "workspace_id": doc.get("workspace_id", ""),
        "scenario_id": doc.get("scenario_id", ""),
        "config_snapshot": doc.get("config_snapshot", {}),
        "engine_version": doc.get("engine_version", settings.ENGINE_VERSION),
        "seed": doc.get("seed", 42),
        "status": doc.get("status", "completed"),
        "progress": doc.get("progress", 100),
        "metrics": doc.get("metrics", {}),
        "error_summary": doc.get("error_summary"),
        "created_at": c_at.isoformat() if hasattr(c_at, "isoformat") else str(c_at) if c_at else None,
        "completed_at": comp_at.isoformat() if hasattr(comp_at, "isoformat") else str(comp_at) if comp_at else None,
    }


class RunService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = RunRepository(db)
        self.scenario_repo = ScenarioRepository(db)

    async def create_run(
        self,
        workspace_id: str,
        user_id: str,
        scenario_id: str,
        replications_override: int | None = None,
        seed_override: int | None = None,
    ) -> dict:
        scenario = await self.scenario_repo.get_by_id(scenario_id, workspace_id)
        if not scenario:
            raise AppError("NOT_FOUND", "Scenario not found", 404)
        if scenario["status"] != "ready":
            raise AppError(
                "SCENARIO_NOT_READY",
                f"Scenario must be in 'ready' status to run (current: {scenario['status']})",
                400,
            )

        config_snapshot = dict(scenario["config"])
        if replications_override is not None:
            config_snapshot["replications"] = replications_override
        seed = seed_override if seed_override is not None else config_snapshot.get("seed", 42)
        config_snapshot["seed"] = seed

        doc = await self.repo.create_run(
            workspace_id=workspace_id,
            scenario_id=scenario_id,
            config_snapshot=config_snapshot,
            engine_version=settings.ENGINE_VERSION,
            seed=seed,
        )

        run_id = str(doc["_id"])

        # Enqueue Celery task if enabled; otherwise execute inline with SimPy engine
        enqueued = False
        if getattr(settings, "USE_CELERY", False):
            try:
                from app.workers.simulation_tasks import run_simulation_task
                run_simulation_task.delay(run_id, config_snapshot, seed)
                enqueued = True
            except Exception:
                enqueued = False

        if not enqueued:
            import asyncio
            asyncio.create_task(self._run_simulation_inline(run_id, workspace_id, config_snapshot))

        return _serialize_run(doc)

    async def _run_simulation_inline(self, run_id: str, workspace_id: str, config: dict) -> None:
        try:
            from app.simulation.replications import run_simulation
            import asyncio

            await self.repo.update_run_status(run_id, workspace_id, "running")
            await self.repo.update_run_progress(run_id, workspace_id, 20)

            def _execute():
                return run_simulation(config)

            aggregate = await asyncio.to_thread(_execute)
            rep_summaries = aggregate.get("replication_summaries", [])
            if rep_summaries:
                await self.repo.save_replication_results(run_id, rep_summaries)

            await self.repo.save_run_metrics(run_id, workspace_id, aggregate)
            await self.repo.update_run_progress(run_id, workspace_id, 100)
            await self.repo.update_run_status(
                run_id, workspace_id, "completed", completed_at=datetime.now(timezone.utc)
            )
        except Exception as e:
            await self.repo.update_run_status(
                run_id, workspace_id, "failed", error_summary=str(e), completed_at=datetime.now(timezone.utc)
            )

    async def get_run(self, run_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_run(run_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Run not found", 404)
        return _serialize_run(doc)

    async def get_run_metrics(self, run_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_run(run_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Run not found", 404)
        if doc["status"] != "completed":
            raise AppError(
                "RUN_NOT_COMPLETED",
                f"Metrics are only available for completed runs (current status: {doc['status']})",
                400,
            )
        metrics = dict(doc.get("metrics", {}))
        if "replication_summaries" not in metrics or not metrics["replication_summaries"]:
            rep_summaries = await self.repo.get_replication_results(run_id)
            if rep_summaries:
                metrics["replication_summaries"] = rep_summaries
        return metrics

    async def list_runs(
        self,
        scenario_id: str,
        workspace_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> dict:
        docs, total = await self.repo.list_runs_by_scenario(scenario_id, workspace_id, skip, limit)
        return {
            "data": [_serialize_run(d) for d in docs],
            "meta": {"total": total, "skip": skip, "limit": limit},
        }

    async def list_workspace_runs(
        self,
        workspace_id: str,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> dict:
        docs, total = await self.repo.list_runs_by_workspace(workspace_id, status=status, skip=skip, limit=limit)
        return {
            "data": [_serialize_run(d) for d in docs],
            "meta": {"total": total, "skip": skip, "limit": limit},
        }

    async def cancel_run(self, run_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_run(run_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Run not found", 404)
        if doc["status"] not in ("queued", "running"):
            raise AppError(
                "CANNOT_CANCEL",
                f"Run cannot be cancelled in status '{doc['status']}'",
                400,
            )
        await self.repo.update_run_status(
            run_id,
            workspace_id,
            "cancelled",
            completed_at=datetime.now(timezone.utc),
        )
        return {"run_id": run_id, "status": "cancelled"}

    async def get_replication_results(self, run_id: str, workspace_id: str) -> list[dict]:
        # Verify ownership
        doc = await self.repo.get_run(run_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Run not found", 404)
        results = await self.repo.get_replication_results(run_id)
        serialized = []
        for r in results:
            r["id"] = str(r["_id"])
            del r["_id"]
            serialized.append(r)
        return serialized
