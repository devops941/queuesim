from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.users

    async def create(self, email: str, password_hash: str, display_name: str) -> dict:
        doc = {
            "email": email.lower().strip(),
            "password_hash": password_hash,
            "display_name": display_name,
            "status": "active",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await self.col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_email(self, email: str) -> dict | None:
        return await self.col.find_one({"email": email.lower().strip()})

    async def find_by_id(self, user_id: str) -> dict | None:
        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        return await self.col.find_one({"_id": oid})

    async def list_all(self, skip: int = 0, limit: int = 50) -> list[dict]:
        cursor = self.col.find({}, {"password_hash": 0}).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def update_status(self, user_id: str, status: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
        )
