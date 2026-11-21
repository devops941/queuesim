"""
CSV import service: parse, validate, and store CSV files for queue simulation.
"""
from __future__ import annotations

import base64
import io
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.errors import AppError
from app.repositories.import_repository import ImportRepository

REQUIRED_COLUMNS = {"arrival_timestamp", "service_duration"}
MAX_FILE_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "workspace_id": doc["workspace_id"],
        "scenario_id": doc["scenario_id"],
        "file_name": doc["file_name"],
        "row_count": doc["row_count"],
        "validation_summary": doc["validation_summary"],
        "status": doc["status"],
        "created_at": doc["created_at"].isoformat(),
    }


class ImportService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = ImportRepository(db)

    async def process_csv_upload(
        self,
        workspace_id: str,
        scenario_id: str,
        file_bytes: bytes,
        filename: str,
    ) -> dict:
        import pandas as pd
        import numpy as np

        # File size check
        if len(file_bytes) > MAX_FILE_BYTES:
            raise AppError(
                "FILE_TOO_LARGE",
                f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB} MB",
                400,
            )

        # Encoding detection and CSV parsing
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                raise AppError("ENCODING_ERROR", "Could not decode file as UTF-8 or Latin-1", 400)

        try:
            df = pd.read_csv(io.StringIO(text))
        except Exception as exc:
            raise AppError("PARSE_ERROR", f"Failed to parse CSV: {exc}", 400)

        if df.empty:
            raise AppError("EMPTY_FILE", "CSV file contains no rows", 400)

        # Normalize column names and map common aliases
        COLUMN_ALIASES = {
            "arrival_time": "arrival_timestamp",
            "arrival": "arrival_timestamp",
            "arrivals": "arrival_timestamp",
            "time": "arrival_timestamp",
            "service_time": "service_duration",
            "service": "service_duration",
            "duration": "service_duration",
        }
        df.rename(columns=lambda c: COLUMN_ALIASES.get(str(c).strip().lower(), str(c).strip().lower()), inplace=True)

        columns_present = set(df.columns)
        if not columns_present.intersection(REQUIRED_COLUMNS):
            raise AppError(
                "MISSING_COLUMNS",
                "CSV must contain at least one of: 'arrival_timestamp' (or 'arrival_time'), 'service_duration' (or 'service_time')",
                400,
            )

        total_rows = len(df)
        row_level_errors: list[dict] = []

        # Check for missing values
        for col in REQUIRED_COLUMNS.intersection(set(df.columns)):
            null_rows = df[df[col].isna()].index.tolist()
            for row_idx in null_rows:
                row_level_errors.append({
                    "row": int(row_idx) + 2,  # 1-based with header
                    "column": col,
                    "reason": "Missing value",
                })

        # Validate service_duration
        if "service_duration" in df.columns:
            df["service_duration"] = pd.to_numeric(df["service_duration"], errors="coerce")
            neg_rows = df[df["service_duration"] < 0].index.tolist()
            for row_idx in neg_rows:
                row_level_errors.append({
                    "row": int(row_idx) + 2,
                    "column": "service_duration",
                    "reason": "Negative duration",
                })
            # Outlier detection (IQR method)
            valid_durations = df["service_duration"].dropna()
            if len(valid_durations) > 4:
                q1 = valid_durations.quantile(0.25)
                q3 = valid_durations.quantile(0.75)
                iqr = q3 - q1
                upper_fence = q3 + 3.0 * iqr
                outlier_rows = df[
                    (df["service_duration"].notna()) & (df["service_duration"] > upper_fence)
                ].index.tolist()
                for row_idx in outlier_rows:
                    row_level_errors.append({
                        "row": int(row_idx) + 2,
                        "column": "service_duration",
                        "reason": f"Outlier (value > {round(upper_fence, 4)})",
                    })

        # Validate arrival_timestamp
        if "arrival_timestamp" in df.columns:
            df["arrival_timestamp"] = pd.to_numeric(df["arrival_timestamp"], errors="coerce")
            neg_arr = df[df["arrival_timestamp"] < 0].index.tolist()
            for row_idx in neg_arr:
                row_level_errors.append({
                    "row": int(row_idx) + 2,
                    "column": "arrival_timestamp",
                    "reason": "Negative timestamp",
                })
            # Duplicates
            dup_mask = df["arrival_timestamp"].duplicated(keep=False) & df["arrival_timestamp"].notna()
            dup_rows = df[dup_mask].index.tolist()
            for row_idx in dup_rows:
                row_level_errors.append({
                    "row": int(row_idx) + 2,
                    "column": "arrival_timestamp",
                    "reason": "Duplicate arrival timestamp",
                })

        error_row_indices = {e["row"] - 2 for e in row_level_errors}
        valid_rows = total_rows - len(set(error_row_indices))

        validation_summary = {
            "total_rows": total_rows,
            "valid_rows": max(valid_rows, 0),
            "error_rows": len(set(error_row_indices)),
            "errors_list": row_level_errors,
        }

        status = "validated" if valid_rows > 0 else "failed"

        # Store file content as base64 (MVP approach)
        storage_key = base64.b64encode(file_bytes).decode("utf-8")

        doc = await self.repo.create(
            workspace_id=workspace_id,
            scenario_id=scenario_id,
            file_name=filename,
            storage_key=storage_key,
            row_count=total_rows,
            validation_summary=validation_summary,
            status=status,
        )

        return _serialize(doc)

    async def get_import(self, import_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_by_id(import_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Import not found", 404)
        return _serialize(doc)

    async def list_imports(self, scenario_id: str, workspace_id: str) -> list[dict]:
        docs = await self.repo.list_by_scenario(scenario_id, workspace_id)
        return [_serialize(d) for d in docs]
