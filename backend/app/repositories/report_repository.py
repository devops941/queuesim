from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import MEMORY_STORE


class ReportRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.reports

    def _now(self):
        return datetime.now(timezone.utc)

    async def create(
        self,
        workspace_id: str,
        run_id: str,
        format: str,
        storage_key: str = "",
        status: str = "pending",
    ) -> dict:
        doc_id = ObjectId()
        doc = {
            "_id": doc_id,
            "workspace_id": workspace_id,
            "run_id": run_id,
            "format": format,
            "storage_key": storage_key,
            "status": status,
            "created_at": self._now(),
        }
        try:
            result = await self.col.insert_one(doc)
            doc["_id"] = result.inserted_id
        except Exception:
            MEMORY_STORE.setdefault("reports", {})[str(doc_id)] = doc
        return doc

    async def get_by_id(self, report_id: str, workspace_id: str) -> dict | None:
        try:
            oid = ObjectId(report_id)
            doc = await self.col.find_one({"_id": oid, "workspace_id": workspace_id})
            if doc:
                return doc
        except Exception:
            pass
        doc = MEMORY_STORE.get("reports", {}).get(str(report_id))
        if doc and doc.get("workspace_id") == workspace_id:
            return doc
        return None

    async def list_by_run(self, run_id: str, workspace_id: str) -> list[dict]:
        try:
            cursor = self.col.find(
                {"run_id": run_id, "workspace_id": workspace_id}
            ).sort("created_at", -1)
            docs = await cursor.to_list(length=100)
            if docs:
                return docs
        except Exception:
            pass
        reports = list(MEMORY_STORE.get("reports", {}).values())
        return [
            r for r in reports
            if r.get("run_id") == run_id and r.get("workspace_id") == workspace_id
        ]

    async def update_status(
        self,
        report_id: str,
        workspace_id: str,
        status: str,
        storage_key: str | None = None,
    ) -> None:
        updates: dict = {"status": status}
        if storage_key is not None:
            updates["storage_key"] = storage_key
        try:
            await self.col.update_one(
                {"_id": ObjectId(report_id), "workspace_id": workspace_id},
                {"$set": updates},
            )
        except Exception:
            pass
        doc = MEMORY_STORE.get("reports", {}).get(str(report_id))
        if doc:
            doc.update(updates)

