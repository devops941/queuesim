"""
Report generation service: produce PDF and CSV reports from completed run metrics.
"""
from __future__ import annotations

import csv
import io
import os
import pathlib
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.errors import AppError
from app.repositories.report_repository import ReportRepository
from app.repositories.run_repository import RunRepository
from app.repositories.scenario_repository import ScenarioRepository


def _storage_dir() -> pathlib.Path:
    path = pathlib.Path(settings.OBJECT_STORAGE_PATH)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _serialize(doc: dict, base_url: str = "") -> dict:
    report_id = str(doc["_id"])
    download_url = None
    if doc.get("status") == "completed" and doc.get("storage_key"):
        download_url = f"{base_url}/api/v1/reports/{report_id}/download"
    return {
        "id": report_id,
        "run_id": doc["run_id"],
        "format": doc["format"],
        "status": doc["status"],
        "download_url": download_url,
        "created_at": doc["created_at"].isoformat(),
    }


def _build_pdf(report_id: str, run_doc: dict, scenario_name: str, metrics: dict) -> str:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
    from reportlab.lib import colors

    storage_path = _storage_dir() / f"{report_id}.pdf"
    doc = SimpleDocTemplate(str(storage_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph("QueueSim Simulation Report", styles["Title"]))
    story.append(Spacer(1, 0.2 * inch))

    # Run metadata
    story.append(Paragraph("Run Metadata", styles["Heading2"]))
    meta_data = [
        ["Field", "Value"],
        ["Report ID", report_id],
        ["Run ID", str(run_doc["_id"])],
        ["Scenario", scenario_name],
        ["Status", run_doc.get("status", "N/A")],
        ["Engine Version", run_doc.get("engine_version", "N/A")],
        ["Seed", str(run_doc.get("seed", "N/A"))],
        ["Created At", run_doc["created_at"].isoformat()],
        [
            "Completed At",
            run_doc["completed_at"].isoformat() if run_doc.get("completed_at") else "N/A",
        ],
        ["Generated At", datetime.now(timezone.utc).isoformat()],
    ]
    t = Table(meta_data, colWidths=[2.5 * inch, 4 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.3 * inch))

    # Scenario config table
    config_snap = run_doc.get("config_snapshot", {})
    if config_snap:
        story.append(Paragraph("Scenario Configuration", styles["Heading2"]))
        config_rows = [["Parameter", "Value"]]
        for k, v in config_snap.items():
            if not isinstance(v, dict):
                config_rows.append([str(k), str(v)])
        tc = Table(config_rows, colWidths=[2.5 * inch, 4 * inch])
        tc.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0FDF4")]),
                ]
            )
        )
        story.append(tc)
        story.append(Spacer(1, 0.3 * inch))

    # KPI summary table
    kpi_keys = [
        ("avg_waiting_time", "Avg Waiting Time (min)"),
        ("std_waiting_time", "Std Waiting Time (min)"),
        ("ci_lower_waiting", "95% CI Lower (min)"),
        ("ci_upper_waiting", "95% CI Upper (min)"),
        ("median_waiting_time", "Median Waiting Time (min)"),
        ("p90_waiting_time", "P90 Waiting Time (min)"),
        ("max_waiting_time", "Max Waiting Time (min)"),
        ("avg_queue_length", "Avg Queue Length"),
        ("max_queue_length", "Max Queue Length"),
        ("server_utilization", "Server Utilization"),
        ("throughput", "Throughput (customers/min)"),
        ("avg_system_time", "Avg System Time (min)"),
        ("customers_arrived", "Customers Arrived"),
        ("customers_served", "Customers Served"),
        ("replications", "Replications"),
    ]
    if metrics:
        story.append(Paragraph("KPI Summary", styles["Heading2"]))
        kpi_rows = [["KPI", "Value"]]
        for key, label in kpi_keys:
            if key in metrics:
                val = metrics[key]
                if isinstance(val, float):
                    val = f"{val:.4f}"
                kpi_rows.append([label, str(val)])
        tk = Table(kpi_rows, colWidths=[3.5 * inch, 3 * inch])
        tk.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F3FF")]),
                ]
            )
        )
        story.append(tk)
        story.append(Spacer(1, 0.3 * inch))

    # Assumptions section
    story.append(Paragraph("Assumptions", styles["Heading2"]))
    assumptions = [
        "1. Inter-arrival times and service durations follow the distributions specified in the scenario configuration.",
        "2. Queue discipline is FCFS (First Come, First Served).",
        "3. All servers are identical and work independently.",
        "4. The system starts empty at time zero.",
        "5. Warm-up period data is excluded from KPI calculations.",
        "6. Each replication uses an independent random seed derived from the base seed.",
    ]
    for a in assumptions:
        story.append(Paragraph(a, styles["Normal"]))
        story.append(Spacer(1, 0.05 * inch))
    story.append(Spacer(1, 0.2 * inch))

    # Limitations note
    story.append(Paragraph("Limitations", styles["Heading2"]))
    story.append(
        Paragraph(
            "This simulation provides statistical estimates based on discrete-event simulation. "
            "Results are subject to simulation variance and should be interpreted alongside confidence intervals. "
            "Real-world queuing systems may exhibit non-stationary behavior, batch arrivals, or priority classes "
            "not modelled here. The model assumes steady-state conditions are reached within the simulation horizon.",
            styles["Normal"],
        )
    )

    doc.build(story)
    return str(storage_path)


def _build_csv(report_id: str, run_doc: dict, scenario_name: str, metrics: dict) -> str:
    storage_path = _storage_dir() / f"{report_id}.csv"
    with open(str(storage_path), "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["QueueSim Simulation Report"])
        writer.writerow([])
        writer.writerow(["Run Metadata"])
        writer.writerow(["Field", "Value"])
        writer.writerow(["Run ID", str(run_doc["_id"])])
        writer.writerow(["Scenario", scenario_name])
        writer.writerow(["Status", run_doc.get("status", "N/A")])
        writer.writerow(["Engine Version", run_doc.get("engine_version", "N/A")])
        writer.writerow(["Seed", str(run_doc.get("seed", "N/A"))])
        writer.writerow(["Created At", run_doc["created_at"].isoformat()])
        completed = run_doc["completed_at"].isoformat() if run_doc.get("completed_at") else "N/A"
        writer.writerow(["Completed At", completed])
        writer.writerow(["Generated At", datetime.now(timezone.utc).isoformat()])
        writer.writerow([])

        # Scenario config
        config_snap = run_doc.get("config_snapshot", {})
        if config_snap:
            writer.writerow(["Scenario Configuration"])
            writer.writerow(["Parameter", "Value"])
            for k, v in config_snap.items():
                if not isinstance(v, dict):
                    writer.writerow([k, v])
            writer.writerow([])

        # KPI summary
        if metrics:
            writer.writerow(["KPI Summary"])
            writer.writerow(["Metric", "Value"])
            skip_keys = {"scenario_config", "replication_summaries"}
            for k, v in metrics.items():
                if k not in skip_keys and not isinstance(v, (dict, list)):
                    writer.writerow([k, v])
            writer.writerow([])

        # Replication summaries
        rep_summaries = metrics.get("replication_summaries", [])
        if rep_summaries:
            writer.writerow(["Replication Summaries"])
            headers = list(rep_summaries[0].keys()) if rep_summaries else []
            safe_headers = [h for h in headers if not isinstance(rep_summaries[0].get(h), (dict, list))]
            writer.writerow(safe_headers)
            for rep in rep_summaries:
                writer.writerow([rep.get(h, "") for h in safe_headers])

    return str(storage_path)


class ReportService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = ReportRepository(db)
        self.run_repo = RunRepository(db)
        self.scenario_repo = ScenarioRepository(db)

    async def generate_report(self, run_id: str, workspace_id: str, fmt: str) -> dict:
        run_doc = await self.run_repo.get_run(run_id, workspace_id)
        if not run_doc:
            raise AppError("NOT_FOUND", "Run not found", 404)
        if run_doc["status"] != "completed":
            raise AppError(
                "RUN_NOT_COMPLETED",
                "Reports can only be generated for completed runs",
                400,
            )

        report_doc = await self.repo.create(
            workspace_id=workspace_id,
            run_id=run_id,
            format=fmt,
            status="pending",
        )
        report_id = str(report_doc["_id"])

        try:
            from app.workers.simulation_tasks import generate_report_task
            generate_report_task.delay(report_id, run_id, fmt)
        except Exception:
            # Celery not available; generate synchronously
            await self._generate_sync(report_id, workspace_id, run_id, fmt, run_doc)

        return _serialize(report_doc)

    async def _generate_sync(
        self,
        report_id: str,
        workspace_id: str,
        run_id: str,
        fmt: str,
        run_doc: dict,
    ) -> None:
        metrics = run_doc.get("metrics", {})
        scenario_name = "Unknown"
        try:
            scenario = await self.scenario_repo.get_by_id(run_doc["scenario_id"], workspace_id)
            if scenario:
                scenario_name = scenario.get("name", scenario_name)
        except Exception:
            pass

        try:
            if fmt == "pdf":
                file_path = _build_pdf(report_id, run_doc, scenario_name, metrics)
            else:
                file_path = _build_csv(report_id, run_doc, scenario_name, metrics)
            await self.repo.update_status(report_id, workspace_id, "completed", storage_key=file_path)
        except Exception as exc:
            await self.repo.update_status(report_id, workspace_id, "failed")

    async def get_report(self, report_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_by_id(report_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Report not found", 404)
        return _serialize(doc)

    async def list_reports(self, run_id: str, workspace_id: str) -> list[dict]:
        docs = await self.repo.list_by_run(run_id, workspace_id)
        return [_serialize(d) for d in docs]

    async def get_report_file_path(self, report_id: str, workspace_id: str) -> str:
        doc = await self.repo.get_by_id(report_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Report not found", 404)
        if doc["status"] != "completed":
            raise AppError("REPORT_NOT_READY", "Report is not yet completed", 400)
        file_path = doc.get("storage_key", "")
        if not file_path or not os.path.exists(file_path):
            raise AppError("FILE_NOT_FOUND", "Report file not found on disk", 404)
        return file_path
