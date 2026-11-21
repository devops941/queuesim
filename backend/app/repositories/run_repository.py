from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import MEMORY_STORE


class RunRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.runs
        self.rep_col = db.replication_results

    def _now(self):
        return datetime.now(timezone.utc)

    async def create_run(
        self,
        workspace_id: str,
        scenario_id: str,
        config_snapshot: dict,
        engine_version: str,
        seed: int,
    ) -> dict:
        doc_id = ObjectId()
        doc = {
            "_id": doc_id,
            "workspace_id": workspace_id,
            "scenario_id": scenario_id,
            "config_snapshot": config_snapshot,
            "engine_version": engine_version,
            "seed": seed,
            "status": "queued",
            "progress": 0,
            "metrics": {},
            "error_summary": None,
            "created_at": self._now(),
            "completed_at": None,
        }
        try:
            result = await self.col.insert_one(doc)
            doc["_id"] = result.inserted_id
        except Exception:
            MEMORY_STORE.setdefault("runs", {})[str(doc_id)] = doc
        return doc

    async def get_run(self, run_id: str, workspace_id: str) -> dict | None:
        try:
            oid = ObjectId(run_id)
            doc = await self.col.find_one({"_id": oid, "workspace_id": workspace_id})
            if doc:
                return doc
        except Exception:
            pass

        doc = MEMORY_STORE.get("runs", {}).get(str(run_id))
        if doc and doc.get("workspace_id") == workspace_id:
            return doc
        return None

    async def update_run_status(
        self,
        run_id: str,
        workspace_id: str,
        status: str,
        error_summary: str | None = None,
        completed_at: datetime | None = None,
    ) -> None:
        updates: dict = {"status": status}
        if error_summary is not None:
            updates["error_summary"] = error_summary
        if completed_at is not None:
            updates["completed_at"] = completed_at
        try:
            await self.col.update_one(
                {"_id": ObjectId(run_id), "workspace_id": workspace_id},
                {"$set": updates},
            )
        except Exception:
            pass

        doc = MEMORY_STORE.get("runs", {}).get(str(run_id))
        if doc:
            doc.update(updates)

    async def update_run_progress(self, run_id: str, workspace_id: str, progress: int) -> None:
        p = min(max(progress, 0), 100)
        try:
            await self.col.update_one(
                {"_id": ObjectId(run_id), "workspace_id": workspace_id},
                {"$set": {"progress": p}},
            )
        except Exception:
            pass

        doc = MEMORY_STORE.get("runs", {}).get(str(run_id))
        if doc:
            doc["progress"] = p

    async def save_run_metrics(self, run_id: str, workspace_id: str, metrics: dict) -> None:
        try:
            await self.col.update_one(
                {"_id": ObjectId(run_id), "workspace_id": workspace_id},
                {"$set": {"metrics": metrics}},
            )
        except Exception:
            pass

        doc = MEMORY_STORE.get("runs", {}).get(str(run_id))
        if doc:
            doc["metrics"] = metrics

    async def list_runs_by_scenario(
        self,
        scenario_id: str,
        workspace_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict], int]:
        try:
            query = {"scenario_id": scenario_id, "workspace_id": workspace_id}
            total = await self.col.count_documents(query)
            cursor = (
                self.col.find(query)
                .sort("created_at", -1)
                .skip(skip)
                .limit(limit)
            )
            docs = await cursor.to_list(length=limit)
            if docs or total > 0:
                return docs, total
        except Exception:
            pass

        runs = list(MEMORY_STORE.get("runs", {}).values())
        filtered = [
            r for r in runs
            if r.get("scenario_id") == scenario_id and r.get("workspace_id") == workspace_id
        ]
        filtered.sort(key=lambda r: r.get("created_at", self._now()), reverse=True)
        return filtered[skip : skip + limit], len(filtered)

    async def list_by_status(self, statuses: list[str]) -> list[dict]:
        try:
            cursor = self.col.find({"status": {"$in": statuses}}).sort("created_at", 1)
            docs = await cursor.to_list(length=200)
            if docs:
                return docs
        except Exception:
            pass

        runs = list(MEMORY_STORE.get("runs", {}).values())
        return [r for r in runs if r.get("status") in statuses]

    async def list_runs_by_workspace(
        self,
        workspace_id: str,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        try:
            query: dict = {"workspace_id": workspace_id}
            if status and status != "all":
                query["status"] = status
            total = await self.col.count_documents(query)
            cursor = (
                self.col.find(query)
                .sort("created_at", -1)
                .skip(skip)
                .limit(limit)
            )
            docs = await cursor.to_list(length=limit)
            if docs or total > 0:
                return docs, total
        except Exception:
            pass

        runs = list(MEMORY_STORE.get("runs", {}).values())
        filtered = [r for r in runs if r.get("workspace_id") == workspace_id]
        if status and status != "all":
            filtered = [r for r in filtered if r.get("status") == status]
        filtered.sort(key=lambda r: r.get("created_at", self._now()), reverse=True)
        return filtered[skip : skip + limit], len(filtered)

    async def list_recent(self, workspace_id: str, limit: int = 5) -> list[dict]:
        try:
            cursor = (
                self.col.find({"workspace_id": workspace_id})
                .sort("created_at", -1)
                .limit(limit)
            )
            docs = await cursor.to_list(length=limit)
            if docs:
                return docs
        except Exception:
            pass

        runs = list(MEMORY_STORE.get("runs", {}).values())
        filtered = [r for r in runs if r.get("workspace_id") == workspace_id]
        filtered.sort(key=lambda r: r.get("created_at", self._now()), reverse=True)
        return filtered[:limit]

    async def save_replication_results(self, run_id: str, summaries: list[dict]) -> None:
        if not summaries:
            return
        docs = [{"run_id": run_id, **s} for s in summaries]
        try:
            await self.rep_col.insert_many(docs)
        except Exception:
            MEMORY_STORE.setdefault("replication_results", {})[str(run_id)] = docs

    async def get_replication_results(self, run_id: str) -> list[dict]:
        try:
            cursor = self.rep_col.find({"run_id": run_id}).sort("replication_no", 1)
            docs = await cursor.to_list(length=1000)
            if docs:
                return docs
        except Exception:
            pass

        return MEMORY_STORE.get("replication_results", {}).get(str(run_id), [])
