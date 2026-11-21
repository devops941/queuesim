"""
Celery tasks for running simulations and generating reports.
Uses synchronous pymongo since Celery tasks are synchronous.
"""
from __future__ import annotations

import pathlib
from datetime import datetime, timezone

from pymongo import MongoClient

from app.core.config import settings
from app.workers.celery_app import celery_app


def _get_sync_db():
    client = MongoClient(settings.MONGODB_URI)
    return client[settings.MONGODB_DATABASE]


def _update_run(db, run_id: str, updates: dict) -> None:
    from bson import ObjectId
    db.runs.update_one({"_id": ObjectId(run_id)}, {"$set": updates})


def _update_report(db, report_id: str, updates: dict) -> None:
    from bson import ObjectId
    db.reports.update_one({"_id": ObjectId(report_id)}, {"$set": updates})


@celery_app.task(name="app.workers.simulation_tasks.run_simulation_task", bind=True, max_retries=2)
def run_simulation_task(self, run_id: str, config: dict, seed: int) -> dict:
    """
    Execute the simulation for a given run_id.
    Updates run status and stores metrics in MongoDB.
    """
    db = _get_sync_db()

    try:
        # Mark as running
        _update_run(db, run_id, {"status": "running", "progress": 0})

        from app.simulation.replications import run_simulation

        n_replications = config.get("replications", 10)

        def progress_callback(rep_no: int, total: int) -> None:
            pct = int(rep_no / total * 100)
            _update_run(db, run_id, {"progress": pct})

        aggregate = run_simulation(config, progress_callback=progress_callback)

        # Save per-replication summaries to replication_results collection
        rep_summaries = aggregate.get("replication_summaries", [])
        if rep_summaries:
            docs = [{"run_id": run_id, **s} for s in rep_summaries]
            db.replication_results.insert_many(docs)

        _update_run(
            db,
            run_id,
            {
                "status": "completed",
                "progress": 100,
                "metrics": aggregate,
                "completed_at": datetime.now(timezone.utc),
                "error_summary": None,
            },
        )

        return {"run_id": run_id, "status": "completed"}

    except Exception as exc:
        error_msg = str(exc)
        _update_run(
            db,
            run_id,
            {
                "status": "failed",
                "error_summary": error_msg,
                "completed_at": datetime.now(timezone.utc),
            },
        )
        raise self.retry(exc=exc, countdown=5) if self.request.retries < self.max_retries else exc


@celery_app.task(name="app.workers.simulation_tasks.generate_report_task", bind=True, max_retries=1)
def generate_report_task(self, report_id: str, run_id: str, fmt: str) -> dict:
    """
    Generate a PDF or CSV report for the given run_id.
    Writes the file to OBJECT_STORAGE_PATH and updates report status.
    """
    db = _get_sync_db()

    try:
        from bson import ObjectId

        run_doc = db.runs.find_one({"_id": ObjectId(run_id)})
        if not run_doc:
            raise ValueError(f"Run '{run_id}' not found")

        metrics = run_doc.get("metrics", {})
        workspace_id = run_doc.get("workspace_id", "")

        scenario_name = "Unknown"
        scenario_id = run_doc.get("scenario_id", "")
        if scenario_id:
            try:
                scenario = db.scenarios.find_one({"_id": ObjectId(scenario_id)})
                if scenario:
                    scenario_name = scenario.get("name", "Unknown")
            except Exception:
                pass

        storage_dir = pathlib.Path(settings.OBJECT_STORAGE_PATH)
        storage_dir.mkdir(parents=True, exist_ok=True)

        if fmt == "pdf":
            file_path = _generate_pdf_sync(report_id, run_doc, scenario_name, metrics, storage_dir)
        else:
            file_path = _generate_csv_sync(report_id, run_doc, scenario_name, metrics, storage_dir)

        _update_report(
            db,
            report_id,
            {"status": "completed", "storage_key": file_path},
        )

        return {"report_id": report_id, "status": "completed", "file_path": file_path}

    except Exception as exc:
        _update_report(
            db,
            report_id,
            {"status": "failed", "storage_key": str(exc)},
        )
        raise exc


def _generate_pdf_sync(
    report_id: str,
    run_doc: dict,
    scenario_name: str,
    metrics: dict,
    storage_dir: pathlib.Path,
) -> str:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    file_path = str(storage_dir / f"{report_id}.pdf")
    doc = SimpleDocTemplate(file_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("QueueSim Simulation Report", styles["Title"]))
    story.append(Spacer(1, 0.2 * inch))

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
        ["Completed At", run_doc["completed_at"].isoformat() if run_doc.get("completed_at") else "N/A"],
        ["Generated At", datetime.now(timezone.utc).isoformat()],
    ]
    t = Table(meta_data, colWidths=[2.5 * inch, 4 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * inch))

    config_snap = run_doc.get("config_snapshot", {})
    if config_snap:
        story.append(Paragraph("Scenario Configuration", styles["Heading2"]))
        config_rows = [["Parameter", "Value"]]
        for k, v in config_snap.items():
            if not isinstance(v, dict):
                config_rows.append([str(k), str(v)])
        tc = Table(config_rows, colWidths=[2.5 * inch, 4 * inch])
        tc.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        story.append(tc)
        story.append(Spacer(1, 0.3 * inch))

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
        tk.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        story.append(tk)
        story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph("Assumptions", styles["Heading2"]))
    for assumption in [
        "1. Inter-arrival times and service durations follow the distributions specified in the scenario configuration.",
        "2. Queue discipline is FCFS (First Come, First Served).",
        "3. All servers are identical and work independently.",
        "4. The system starts empty at time zero.",
        "5. Warm-up period data is excluded from KPI calculations.",
        "6. Each replication uses an independent random seed derived from the base seed.",
    ]:
        story.append(Paragraph(assumption, styles["Normal"]))
        story.append(Spacer(1, 0.05 * inch))
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph("Limitations", styles["Heading2"]))
    story.append(Paragraph(
        "This simulation provides statistical estimates based on discrete-event simulation. "
        "Results are subject to simulation variance and should be interpreted alongside confidence intervals. "
        "Real-world queuing systems may exhibit non-stationary behavior, batch arrivals, or priority classes "
        "not modelled here. The model assumes steady-state conditions are reached within the simulation horizon.",
        styles["Normal"],
    ))

    doc.build(story)
    return file_path


def _generate_csv_sync(
    report_id: str,
    run_doc: dict,
    scenario_name: str,
    metrics: dict,
    storage_dir: pathlib.Path,
) -> str:
    import csv

    file_path = str(storage_dir / f"{report_id}.csv")
    with open(file_path, "w", newline="", encoding="utf-8") as f:
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

        config_snap = run_doc.get("config_snapshot", {})
        if config_snap:
            writer.writerow(["Scenario Configuration"])
            writer.writerow(["Parameter", "Value"])
            for k, v in config_snap.items():
                if not isinstance(v, dict):
                    writer.writerow([k, v])
            writer.writerow([])

        if metrics:
            writer.writerow(["KPI Summary"])
            writer.writerow(["Metric", "Value"])
            skip_keys = {"scenario_config", "replication_summaries"}
            for k, v in metrics.items():
                if k not in skip_keys and not isinstance(v, (dict, list)):
                    writer.writerow([k, v])
            writer.writerow([])

        rep_summaries = metrics.get("replication_summaries", [])
        if rep_summaries:
            writer.writerow(["Replication Summaries"])
            safe_headers = [h for h in rep_summaries[0].keys() if not isinstance(rep_summaries[0].get(h), (dict, list))]
            writer.writerow(safe_headers)
            for rep in rep_summaries:
                writer.writerow([rep.get(h, "") for h in safe_headers])

    return file_path
