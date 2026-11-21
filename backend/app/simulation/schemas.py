from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CustomerRecord:
    customer_no: int
    arrival_time: float
    service_start_time: float
    service_end_time: float
    waiting_time: float
    service_time: float
    system_time: float


@dataclass
class ReplicationSummary:
    replication_no: int
    seed: int
    customers_arrived: int
    customers_served: int
    avg_waiting_time: float
    median_waiting_time: float
    p90_waiting_time: float
    max_waiting_time: float
    avg_queue_length: float
    max_queue_length: int
    server_utilization: float
    throughput: float
    avg_system_time: float
    measurement_duration: float
    queue_length_series: list = field(default_factory=list)
    wait_histogram: list = field(default_factory=list)


@dataclass
class RunSummary:
    scenario_config: dict
    replications: int
    avg_waiting_time: float
    std_waiting_time: float
    ci_lower_waiting: float
    ci_upper_waiting: float
    median_waiting_time: float
    p90_waiting_time: float
    max_waiting_time: float
    avg_queue_length: float
    max_queue_length: int
    server_utilization: float
    throughput: float
    avg_system_time: float
    customers_arrived: int
    customers_served: int
    replication_summaries: list = field(default_factory=list)
