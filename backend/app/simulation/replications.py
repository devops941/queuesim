"""
Run multiple independent replications and aggregate results.
"""
import numpy as np
from app.simulation.queue_model import run_single_replication
from app.simulation.metrics import compute_replication_metrics, aggregate_replications
from app.simulation.schemas import ReplicationSummary


def derive_replication_seed(base_seed: int, replication_no: int) -> int:
    """Deterministic seed per replication from base seed."""
    rng = np.random.default_rng(base_seed)
    seeds = rng.integers(0, 2**31, size=replication_no + 1)
    return int(seeds[replication_no])


def run_simulation(config: dict, progress_callback=None) -> dict:
    """
    Run all replications for a scenario config.

    Args:
        config: scenario config dict (servers, horizon_minutes, warm_up_minutes,
                replications, seed, arrival, service)
        progress_callback: optional callable(replication_no, total)

    Returns:
        dict with aggregate metrics and per-replication summaries
    """
    n_replications: int = config.get("replications", 10)
    base_seed: int = config.get("seed", 42)
    n_servers: int = config["servers"]
    horizon: float = config["horizon_minutes"]
    warm_up: float = config.get("warm_up_minutes", 0.0)

    summaries: list[ReplicationSummary] = []

    for rep in range(n_replications):
        rep_seed = derive_replication_seed(base_seed, rep)
        records, queue_events, busy_time = run_single_replication(config, rep_seed, rep + 1)

        summary = compute_replication_metrics(
            records=records,
            queue_events=queue_events,
            busy_time=busy_time,
            n_servers=n_servers,
            horizon=horizon,
            warm_up=warm_up,
            replication_no=rep + 1,
            seed=rep_seed,
        )
        summaries.append(summary)

        if progress_callback:
            progress_callback(rep + 1, n_replications)

    aggregate = aggregate_replications(summaries, config)
    aggregate["replication_summaries"] = [
        {
            "replication_no": s.replication_no,
            "seed": s.seed,
            "customers_arrived": s.customers_arrived,
            "customers_served": s.customers_served,
            "avg_waiting_time": s.avg_waiting_time,
            "median_waiting_time": s.median_waiting_time,
            "p90_waiting_time": s.p90_waiting_time,
            "max_waiting_time": s.max_waiting_time,
            "avg_queue_length": s.avg_queue_length,
            "max_queue_length": s.max_queue_length,
            "server_utilization": s.server_utilization,
            "throughput": s.throughput,
            "avg_system_time": s.avg_system_time,
            "queue_length_series": s.queue_length_series,
            "wait_histogram": s.wait_histogram,
        }
        for s in summaries
    ]

    return aggregate
