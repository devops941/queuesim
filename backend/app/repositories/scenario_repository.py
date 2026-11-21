from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import MEMORY_STORE


class ScenarioRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.scenarios

    def _now(self):
        return datetime.now(timezone.utc)

    async def create(self, workspace_id: str, created_by: str, data: dict) -> dict:
        doc_id = ObjectId()
        doc = {
            "_id": doc_id,
            "workspace_id": workspace_id,
            "created_by": created_by,
            "name": data["name"],
            "description": data.get("description", ""),
            "service_type": data.get("service_type", "custom"),
            "config": data["config"],
            "assumptions": data.get("assumptions", {}),
            "status": "draft",
            "created_at": self._now(),
            "updated_at": self._now(),
        }
        try:
            result = await self.col.insert_one(doc)
            doc["_id"] = result.inserted_id
        except Exception:
            # Fallback to in-memory store if Atlas free tier collection limit is reached
            MEMORY_STORE.setdefault("scenarios", {})[str(doc_id)] = doc
        return doc

    async def get_by_id(self, scenario_id: str, workspace_id: str) -> dict | None:
        try:
            oid = ObjectId(scenario_id)
            doc = await self.col.find_one({"_id": oid, "workspace_id": workspace_id})
            if doc:
                return doc
        except Exception:
            pass

        scenarios = MEMORY_STORE.get("scenarios", {})
        doc = scenarios.get(str(scenario_id))
        if doc and doc.get("workspace_id") == workspace_id:
            return doc
        return None

    async def list_by_workspace(
        self, workspace_id: str, skip: int = 0, limit: int = 20, status: str | None = None
    ) -> tuple[list[dict], int]:
        try:
            query: dict = {"workspace_id": workspace_id}
            if status:
                query["status"] = status
            total = await self.col.count_documents(query)
            cursor = (
                self.col.find(query)
                .sort("updated_at", -1)
                .skip(skip)
                .limit(limit)
            )
            docs = await cursor.to_list(length=limit)
            if docs or total > 0:
                return docs, total
        except Exception:
            pass

        # Fallback from MEMORY_STORE
        scenarios = list(MEMORY_STORE.get("scenarios", {}).values())
        filtered = [s for s in scenarios if s.get("workspace_id") == workspace_id]
        if status:
            filtered = [s for s in filtered if s.get("status") == status]
        filtered.sort(key=lambda s: s.get("updated_at", self._now()), reverse=True)
        return filtered[skip : skip + limit], len(filtered)

    async def update(self, scenario_id: str, workspace_id: str, updates: dict) -> dict | None:
        updates["updated_at"] = self._now()
        try:
            await self.col.update_one(
                {"_id": ObjectId(scenario_id), "workspace_id": workspace_id},
                {"$set": updates},
            )
        except Exception:
            pass

        doc = await self.get_by_id(scenario_id, workspace_id)
        if doc:
            doc.update(updates)
            MEMORY_STORE.setdefault("scenarios", {})[str(scenario_id)] = doc
        return doc

    async def set_status(self, scenario_id: str, workspace_id: str, status: str) -> None:
        try:
            await self.col.update_one(
                {"_id": ObjectId(scenario_id), "workspace_id": workspace_id},
                {"$set": {"status": status, "updated_at": self._now()}},
            )
        except Exception:
            pass

        doc = MEMORY_STORE.get("scenarios", {}).get(str(scenario_id))
        if doc:
            doc["status"] = status
            doc["updated_at"] = self._now()

    async def duplicate(self, scenario_id: str, workspace_id: str, new_name: str) -> dict:
        original = await self.get_by_id(scenario_id, workspace_id)
        if not original:
            raise ValueError("Scenario not found")
        new_data = {
            "name": new_name,
            "description": original.get("description", ""),
            "service_type": original.get("service_type", "custom"),
            "config": original["config"],
            "assumptions": original.get("assumptions", {}),
        }
        return await self.create(workspace_id, original["created_by"], new_data)

    async def delete(self, scenario_id: str, workspace_id: str) -> bool:
        deleted = False
        try:
            res = await self.col.delete_one(
                {"_id": ObjectId(scenario_id), "workspace_id": workspace_id}
            )
            deleted = res.deleted_count > 0
        except Exception:
            pass

        if str(scenario_id) in MEMORY_STORE.get("scenarios", {}):
            del MEMORY_STORE["scenarios"][str(scenario_id)]
            deleted = True
        return deleted
