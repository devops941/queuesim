"""
Demo data seeder for QueueSim.
Run: python scripts/seed_demo.py
Requires: MONGODB_URI env var or uses default localhost.
"""
import asyncio
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DATABASE", "QueueSim")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


DEMO_SCENARIOS = [
    {
        "name": "Bank Counter - Peak Hours",
        "description": "Simulates a 3-counter bank during peak morning hours.",
        "service_type": "bank_counter",
        "config": {
            "servers": 3, "horizon_minutes": 480, "warm_up_minutes": 30,
            "replications": 20, "seed": 1234, "queue_discipline": "FIFO",
            "arrival": {"distribution": "exponential", "mean_interarrival": 3.0},
            "service": {"distribution": "exponential", "mean": 8.0},
        },
        "status": "ready",
    },
    {
        "name": "Clinic Registration Desk",
        "description": "2-counter clinic registration with normal service times.",
        "service_type": "clinic_registration",
        "config": {
            "servers": 2, "horizon_minutes": 360, "warm_up_minutes": 20,
            "replications": 15, "seed": 5678, "queue_discipline": "FIFO",
            "arrival": {"distribution": "exponential", "mean_interarrival": 5.0},
            "service": {"distribution": "normal", "mean": 10.0, "std_dev": 2.0},
        },
        "status": "ready",
    },
    {
        "name": "College Admission Office",
        "description": "Single-counter admission office with uniform service.",
        "service_type": "college_office",
        "config": {
            "servers": 1, "horizon_minutes": 240, "warm_up_minutes": 0,
            "replications": 10, "seed": 9012, "queue_discipline": "FIFO",
            "arrival": {"distribution": "exponential", "mean_interarrival": 8.0},
            "service": {"distribution": "uniform", "min_time": 5.0, "max_time": 15.0},
        },
        "status": "draft",
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]

    # Clear demo data
    print("Clearing existing demo data...")
    await db.users.delete_many({"email": "demo@queuesim.example"})

    # Create demo user
    print("Creating demo user: demo@queuesim.example / Demo@12345")
    pw_hash = pwd_context.hash("Demo@12345")
    now = datetime.now(timezone.utc)
    user_result = await db.users.insert_one({
        "email": "demo@queuesim.example",
        "password_hash": pw_hash,
        "display_name": "Demo User",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    })
    user_id = str(user_result.inserted_id)

    # Create workspace
    ws_result = await db.workspaces.insert_one({
        "name": "Demo Workspace",
        "owner_user_id": user_id,
        "created_at": now,
    })
    ws_id = str(ws_result.inserted_id)

    await db.memberships.insert_one({
        "workspace_id": ws_id,
        "user_id": user_id,
        "role": "owner",
        "joined_at": now,
    })

    # Create scenarios
    for scenario_data in DEMO_SCENARIOS:
        await db.scenarios.insert_one({
            **scenario_data,
            "workspace_id": ws_id,
            "created_by": user_id,
            "assumptions": {},
            "created_at": now,
            "updated_at": now,
        })
        print(f"  Created scenario: {scenario_data['name']}")

    print("\nDemo data seeded successfully!")
    print(f"  User: demo@queuesim.example")
    print(f"  Password: Demo@12345")
    print(f"  Workspace ID: {ws_id}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
