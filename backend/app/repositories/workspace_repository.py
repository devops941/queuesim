from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class WorkspaceRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.ws_col = db.workspaces
        self.mem_col = db.memberships
        self.token_col = db.refresh_tokens

    async def create_workspace(self, name: str, owner_user_id: str) -> dict:
        doc = {
            "name": name,
            "owner_user_id": owner_user_id,
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.ws_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def add_member(self, workspace_id: str, user_id: str, role: str = "owner") -> dict:
        doc = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "role": role,
            "joined_at": datetime.now(timezone.utc),
        }
        await self.mem_col.insert_one(doc)
        return doc

    async def get_membership(self, workspace_id: str, user_id: str) -> dict | None:
        return await self.mem_col.find_one(
            {"workspace_id": workspace_id, "user_id": user_id}
        )

    async def list_user_workspaces(self, user_id: str) -> list[dict]:
        memberships = await self.mem_col.find({"user_id": user_id}).to_list(length=100)
        ws_ids = [ObjectId(m["workspace_id"]) for m in memberships]
        workspaces = await self.ws_col.find({"_id": {"$in": ws_ids}}).to_list(length=100)
        ws_map = {str(w["_id"]): w for w in workspaces}
        result = []
        for m in memberships:
            ws = ws_map.get(m["workspace_id"])
            if ws:
                result.append({**ws, "role": m["role"]})
        return result

    async def save_refresh_token(self, user_id: str, token: str, expires_at: datetime) -> None:
        await self.token_col.insert_one(
            {"user_id": user_id, "token": token, "expires_at": expires_at, "revoked": False}
        )

    async def find_refresh_token(self, token: str) -> dict | None:
        return await self.token_col.find_one({"token": token, "revoked": False})

    async def revoke_refresh_token(self, token: str) -> None:
        await self.token_col.update_one({"token": token}, {"$set": {"revoked": True}})

    async def list_workspace_members(self, workspace_id: str) -> list[dict]:
        return await self.mem_col.find({"workspace_id": workspace_id}).to_list(length=200)

    async def update_member_role(self, workspace_id: str, user_id: str, role: str) -> None:
        await self.mem_col.update_one(
            {"workspace_id": workspace_id, "user_id": user_id},
            {"$set": {"role": role}},
        )

    async def remove_member(self, workspace_id: str, user_id: str) -> None:
        await self.mem_col.delete_one({"workspace_id": workspace_id, "user_id": user_id})
