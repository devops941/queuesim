from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
from datetime import datetime, timezone
import bson

_client: AsyncIOMotorClient | None = None

ADMIN_USER_ID = "000000000000000000000001"
ADMIN_WS_ID = "000000000000000000000002"

# Safe fallback store when MongoDB Atlas reaches free-tier collection limits (code 8000)
MEMORY_STORE: dict = {
    "users": {
        ADMIN_USER_ID: {
            "_id": bson.ObjectId(ADMIN_USER_ID),
            "email": "admin@gmail.com",
            "password_hash": "$2b$12$k3yCToDCI1epxAXB41Yxn.yY1cRgL4ALtzNwsEqcGwlIwATm0STky",
            "display_name": "Admin",
            "status": "active",
        },
    },
    "users_by_email": {},
    "workspaces": {
        ADMIN_WS_ID: {
            "_id": bson.ObjectId(ADMIN_WS_ID),
            "name": "Admin Simulation Workspace",
            "owner_user_id": ADMIN_USER_ID,
            "role": "owner",
        },
    },
    "user_workspaces": {
        ADMIN_USER_ID: [
            {
                "_id": bson.ObjectId(ADMIN_WS_ID),
                "name": "Admin Simulation Workspace",
                "owner_user_id": ADMIN_USER_ID,
                "role": "owner",
            }
        ],
    },
    "refresh_tokens": {},
    "scenarios": {},
    "runs": {},
    "replication_results": {},
    "imports": {},
}
MEMORY_STORE["users_by_email"]["admin@gmail.com"] = MEMORY_STORE["users"][ADMIN_USER_ID]

_init_now = datetime.now(timezone.utc)
MEMORY_STORE["scenarios"] = {}
MEMORY_STORE["runs"] = {}
MEMORY_STORE["reports"] = {}
MEMORY_STORE["replication_results"] = {}


def clear_all_data(include_scenarios: bool = True):
    MEMORY_STORE["runs"].clear()
    MEMORY_STORE["reports"].clear()
    MEMORY_STORE["replication_results"].clear()
    MEMORY_STORE.setdefault("imports", {}).clear()
    if include_scenarios:
        MEMORY_STORE["scenarios"].clear()



import asyncio

async def connect_db() -> None:
    global _client
    try:
        _client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
        db = _client[settings.MONGODB_DATABASE]
        await asyncio.wait_for(_create_indexes(db), timeout=2.0)
    except Exception as e:
        print(f"Notice: MongoDB index creation or connection deferred (in-memory fallback active): {e}")


async def close_db() -> None:
    global _client
    if _client:
        try:
            _client.close()
        except Exception:
            pass
        _client = None


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
    return _client[settings.MONGODB_DATABASE]


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.workspaces.create_index("owner_user_id")
    await db.memberships.create_index(
        [("workspace_id", 1), ("user_id", 1)], unique=True
    )
    await db.refresh_tokens.create_index("token", unique=True)
    await db.refresh_tokens.create_index("user_id")
    await db.scenarios.create_index([("workspace_id", 1), ("updated_at", -1)])
    await db.imports.create_index([("workspace_id", 1), ("scenario_id", 1)])
    await db.runs.create_index(
        [("workspace_id", 1), ("scenario_id", 1), ("created_at", -1)]
    )
    await db.replication_results.create_index(
        [("run_id", 1), ("replication_no", 1)]
    )
    await db.customer_events.create_index(
        [("run_id", 1), ("replication_no", 1)]
    )
    await db.reports.create_index([("run_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index(
        [("workspace_id", 1), ("created_at", -1)]
    )
