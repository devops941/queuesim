from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class AuditRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.audit_logs

    def _now(self):
        return datetime.now(timezone.utc)

    async def log_event(
        self,
        workspace_id: str,
        actor_id: str,
        action: str,
        entity_type: str,
        entity_id: str,
        request_id: str = "",
    ) -> dict:
        doc = {
            "workspace_id": workspace_id,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "request_id": request_id,
            "created_at": self._now(),
        }
        result = await self.col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def list_by_workspace(
        self,
        workspace_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        query = {"workspace_id": workspace_id}
        total = await self.col.count_documents(query)
        cursor = (
            self.col.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return docs, total
