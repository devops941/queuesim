"""
Comparison and sensitivity analysis service.
"""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import AppError
from app.repositories.run_repository import RunRepository
from app.repositories.scenario_repository import ScenarioRepository
from app.simulation.replications import run_simulation

NUMERIC_KPI_KEYS = [
    "avg_waiting_time",
    "std_waiting_time",
    "median_waiting_time",
    "p90_waiting_time",
    "max_waiting_time",
    "avg_queue_length",
    "max_queue_length",
    "server_utilization",
    "throughput",
    "avg_system_time",
    "customers_arrived",
    "customers_served",
    "replications",
]


class ComparisonService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.run_repo = RunRepository(db)
        self.scenario_repo = ScenarioRepository(db)

    async def compare_runs(
        self,
        run_ids: list[str],
        workspace_id: str,
    ) -> dict:
        if len(run_ids) < 2:
            raise AppError("INVALID_INPUT", "At least two run IDs are required for comparison", 400)

        runs = []
        for run_id in run_ids:
            doc = await self.run_repo.get_run(run_id, workspace_id)
            if not doc:
                raise AppError("NOT_FOUND", f"Run '{run_id}' not found", 404)
            if doc["status"] != "completed":
                raise AppError(
                    "RUN_NOT_COMPLETED",
                    f"Run '{run_id}' is not completed (status: {doc['status']})",
                    400,
                )
            runs.append(doc)

        # Warnings for mismatched configs
        warnings: list[str] = []
        base_config = runs[0].get("config_snapshot", {})
        for run in runs[1:]:
            cfg = run.get("config_snapshot", {})
            if cfg.get("horizon_minutes") != base_config.get("horizon_minutes"):
                warnings.append(
                    f"Run '{str(run['_id'])}' has a different horizon_minutes "
                    f"({cfg.get('horizon_minutes')}) vs baseline ({base_config.get('horizon_minutes')})"
                )
            if cfg.get("warm_up_minutes") != base_config.get("warm_up_minutes"):
                warnings.append(
                    f"Run '{str(run['_id'])}' has a different warm_up_minutes "
                    f"({cfg.get('warm_up_minutes')}) vs baseline ({base_config.get('warm_up_minutes')})"
                )

        base_metrics = runs[0].get("metrics", {})
        side_by_side: list[dict] = []

        for i, run in enumerate(runs):
            metrics = run.get("metrics", {})
            delta: dict = {}
            pct_change: dict = {}

            if i > 0:
                for key in NUMERIC_KPI_KEYS:
                    base_val = base_metrics.get(key)
                    curr_val = metrics.get(key)
                    if base_val is not None and curr_val is not None:
                        try:
                            d = float(curr_val) - float(base_val)
                            delta[key] = round(d, 6)
                            if float(base_val) != 0:
                                pct_change[key] = round(d / abs(float(base_val)) * 100, 4)
                            else:
                                pct_change[key] = None
                        except (TypeError, ValueError):
                            pass

            side_by_side.append({
                "run_id": str(run["_id"]),
                "scenario_id": run.get("scenario_id", ""),
                "metrics": {k: metrics.get(k) for k in NUMERIC_KPI_KEYS if k in metrics},
                "delta": delta,
                "pct_change": pct_change,
            })

        return {
            "comparison": side_by_side,
            "warnings": warnings,
            "baseline_run_id": str(runs[0]["_id"]),
        }

    async def run_sensitivity(
        self,
        scenario_id: str,
        workspace_id: str,
        vary_param: str,
        values: list[float],
    ) -> dict:
        valid_params = {"servers", "mean_interarrival", "service_mean"}
        if vary_param not in valid_params:
            raise AppError(
                "INVALID_PARAM",
                f"vary_param must be one of: {', '.join(sorted(valid_params))}",
                400,
            )

        scenario = await self.scenario_repo.get_by_id(scenario_id, workspace_id)
        if not scenario:
            raise AppError("NOT_FOUND", "Scenario not found", 404)

        base_config = dict(scenario["config"])
        # Use fewer replications for sensitivity analysis
        base_config["replications"] = 5

        results: list[dict] = []

        for val in values:
            config = dict(base_config)
            if vary_param == "servers":
                config["servers"] = max(1, int(val))
            elif vary_param == "mean_interarrival":
                arrival = dict(config.get("arrival", {}))
                arrival["mean"] = float(val)
                config["arrival"] = arrival
            elif vary_param == "service_mean":
                service = dict(config.get("service", {}))
                service["mean"] = float(val)
                config["service"] = service

            try:
                agg = run_simulation(config)
                results.append({
                    "value": val,
                    "avg_waiting_time": agg.get("avg_waiting_time", 0.0),
                    "server_utilization": agg.get("server_utilization", 0.0),
                    "avg_queue_length": agg.get("avg_queue_length", 0.0),
                    "throughput": agg.get("throughput", 0.0),
                })
            except Exception as exc:
                results.append({
                    "value": val,
                    "avg_waiting_time": None,
                    "server_utilization": None,
                    "avg_queue_length": None,
                    "throughput": None,
                    "error": str(exc),
                })

        return {
            "scenario_id": scenario_id,
            "vary_param": vary_param,
            "results": results,
        }
