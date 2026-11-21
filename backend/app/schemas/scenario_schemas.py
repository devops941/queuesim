from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class ArrivalConfig(BaseModel):
    distribution: Literal["fixed", "exponential"] = "exponential"
    mean_interarrival: float = Field(gt=0, description="Mean inter-arrival time in minutes")

    @field_validator("mean_interarrival", mode="before")
    @classmethod
    def clean_mean_interarrival(cls, v):
        if v == "" or v is None:
            return 4.0
        try:
            val = float(v)
            return val if val > 0 else 4.0
        except (ValueError, TypeError):
            return 4.0


class ServiceConfig(BaseModel):
    distribution: Literal["fixed", "exponential", "normal", "uniform"] = "exponential"
    mean: Optional[float] = Field(None, gt=0)
    std_dev: Optional[float] = Field(None, gt=0)
    min_time: Optional[float] = Field(None, gt=0)
    max_time: Optional[float] = Field(None, gt=0)

    @field_validator("mean", "std_dev", "min_time", "max_time", mode="before")
    @classmethod
    def clean_empty_floats(cls, v):
        if v == "" or v is None:
            return None
        try:
            val = float(v)
            return val if val > 0 else None
        except (ValueError, TypeError):
            return None

    @field_validator("std_dev")
    @classmethod
    def std_dev_positive(cls, v):
        if v is not None and v <= 0:
            return None
        return v


class ScenarioConfig(BaseModel):
    servers: int = Field(ge=1, le=100)
    horizon_minutes: float = Field(gt=0)
    warm_up_minutes: float = Field(ge=0, default=0)
    replications: int = Field(ge=1, le=100, default=10)
    seed: int = Field(default=42)
    queue_discipline: Literal["FIFO"] = "FIFO"
    arrival: ArrivalConfig
    service: ServiceConfig

    @field_validator("servers", "replications", "seed", mode="before")
    @classmethod
    def clean_ints(cls, v):
        if v == "" or v is None:
            return 3
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return 3

    @field_validator("horizon_minutes", mode="before")
    @classmethod
    def clean_horizon(cls, v):
        if v == "" or v is None:
            return 480.0
        try:
            val = float(v)
            return val if val > 0 else 480.0
        except (ValueError, TypeError):
            return 480.0

    @field_validator("warm_up_minutes", mode="before")
    @classmethod
    def clean_warm_up_pre(cls, v):
        if v == "" or v is None:
            return 0.0
        try:
            val = float(v)
            return val if val >= 0 else 0.0
        except (ValueError, TypeError):
            return 0.0

    @field_validator("warm_up_minutes")
    @classmethod
    def warm_up_less_than_horizon(cls, v, info):
        horizon = info.data.get("horizon_minutes")
        if horizon is not None and v >= horizon:
            return max(0.0, round(float(horizon) * 0.1, 1))
        return v


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    service_type: str = Field(default="custom", max_length=100)
    config: ScenarioConfig


class ScenarioUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    service_type: Optional[str] = None
    config: Optional[ScenarioConfig] = None


class ScenarioResponse(BaseModel):
    id: str
    workspace_id: str
    created_by: str
    name: str
    description: str
    service_type: str
    config: dict
    status: str
    created_at: str
    updated_at: str


class ScenarioListResponse(BaseModel):
    data: list[ScenarioResponse]
    meta: dict


PRESETS = {
    "bank_counter": ScenarioConfig(
        servers=3,
        horizon_minutes=480,
        warm_up_minutes=30,
        replications=20,
        seed=1234,
        queue_discipline="FIFO",
        arrival=ArrivalConfig(distribution="exponential", mean_interarrival=3.0),
        service=ServiceConfig(distribution="exponential", mean=8.0),
    ),
    "clinic_registration": ScenarioConfig(
        servers=2,
        horizon_minutes=360,
        warm_up_minutes=20,
        replications=20,
        seed=5678,
        queue_discipline="FIFO",
        arrival=ArrivalConfig(distribution="exponential", mean_interarrival=5.0),
        service=ServiceConfig(distribution="normal", mean=10.0, std_dev=2.0),
    ),
    "college_office": ScenarioConfig(
        servers=1,
        horizon_minutes=240,
        warm_up_minutes=0,
        replications=15,
        seed=9012,
        queue_discipline="FIFO",
        arrival=ArrivalConfig(distribution="exponential", mean_interarrival=8.0),
        service=ServiceConfig(distribution="uniform", min_time=5.0, max_time=15.0),
    ),
    "ticket_counter": ScenarioConfig(
        servers=4,
        horizon_minutes=600,
        warm_up_minutes=60,
        replications=30,
        seed=3456,
        queue_discipline="FIFO",
        arrival=ArrivalConfig(distribution="exponential", mean_interarrival=2.0),
        service=ServiceConfig(distribution="exponential", mean=6.0),
    ),
}
