from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import MEMORY_STORE


class ImportRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.imports

    def _now(self):
        return datetime.now(timezone.utc)

    async def create(
        self,
        workspace_id: str,
        scenario_id: str,
        file_name: str,
        storage_key: str,
        row_count: int,
        validation_summary: dict,
        status: str = "validated",
    ) -> dict:
        doc_id = ObjectId()
        doc = {
            "_id": doc_id,
            "workspace_id": workspace_id,
            "scenario_id": scenario_id,
            "file_name": file_name,
            "storage_key": storage_key,
            "row_count": row_count,
            "validation_summary": validation_summary,
            "status": status,
            "created_at": self._now(),
        }
        try:
            result = await self.col.insert_one(doc)
            doc["_id"] = result.inserted_id
        except Exception:
            # Fallback to safe memory store when Atlas limit or offline
            MEMORY_STORE.setdefault("imports", {})[str(doc_id)] = doc
        return doc

    async def get_by_id(self, import_id: str, workspace_id: str) -> dict | None:
        try:
            oid = ObjectId(import_id)
            doc = await self.col.find_one({"_id": oid, "workspace_id": workspace_id})
            if doc:
                return doc
        except Exception:
            pass

        imports = MEMORY_STORE.get("imports", {})
        doc = imports.get(str(import_id))
        if doc and doc.get("workspace_id") == workspace_id:
            return doc
        return None

    async def list_by_scenario(self, scenario_id: str, workspace_id: str) -> list[dict]:
        try:
            cursor = self.col.find(
                {"scenario_id": scenario_id, "workspace_id": workspace_id}
            ).sort("created_at", -1)
            docs = await cursor.to_list(length=100)
            if docs:
                return docs
        except Exception:
            pass

        return [
            doc
            for doc in MEMORY_STORE.get("imports", {}).values()
            if doc.get("scenario_id") == scenario_id and doc.get("workspace_id") == workspace_id
        ]

    async def update_status(self, import_id: str, workspace_id: str, status: str) -> None:
        try:
            await self.col.update_one(
                {"_id": ObjectId(import_id), "workspace_id": workspace_id},
                {"$set": {"status": status}},
            )
        except Exception:
            pass
        if str(import_id) in MEMORY_STORE.get("imports", {}):
            MEMORY_STORE["imports"][str(import_id)]["status"] = status
