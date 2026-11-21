"""
Aggregate customer records and time-series events into KPI summaries.
"""
import numpy as np
from app.simulation.schemas import CustomerRecord, ReplicationSummary


def compute_replication_metrics(
    records: list[CustomerRecord],
    queue_events: list[tuple[float, int]],
    busy_time: float,
    n_servers: int,
    horizon: float,
    warm_up: float,
    replication_no: int,
    seed: int,
) -> ReplicationSummary:
    measurement_start = warm_up
    measurement_end = horizon

    # Filter to records completing after warm-up
    warm_records = [r for r in records if r.service_end_time > measurement_start]

    if not warm_records:
        return ReplicationSummary(
            replication_no=replication_no,
            seed=seed,
            customers_arrived=len(records),
            customers_served=0,
            avg_waiting_time=0.0,
            median_waiting_time=0.0,
            p90_waiting_time=0.0,
            max_waiting_time=0.0,
            avg_queue_length=0.0,
            max_queue_length=0,
            server_utilization=0.0,
            throughput=0.0,
            avg_system_time=0.0,
            measurement_duration=measurement_end - measurement_start,
            queue_length_series=[],
            wait_histogram=[],
        )

    waits = np.array([r.waiting_time for r in warm_records])
    system_times = np.array([r.system_time for r in warm_records])

    measurement_duration = measurement_end - measurement_start

    # Time-weighted average queue length
    avg_q = _time_weighted_queue(queue_events, measurement_start, measurement_end)
    max_q = max((q for _, q in queue_events), default=0)

    # Utilization: busy server time / (n_servers * measurement_duration)
    denom = n_servers * measurement_duration
    utilization = min(busy_time / denom, 1.0) if denom > 0 else 0.0

    throughput = len(warm_records) / measurement_duration if measurement_duration > 0 else 0.0

    # Build histogram buckets for waiting times
    if len(waits) > 0 and waits.max() > 0:
        bins = np.linspace(0, waits.max(), min(20, len(waits) + 1))
        counts, edges = np.histogram(waits, bins=bins)
        histogram = [
            {"bucket": round(float(edges[i]), 2), "count": int(counts[i])}
            for i in range(len(counts))
        ]
    else:
        histogram = [{"bucket": 0.0, "count": len(waits)}]

    # Sample queue length over time for chart (down-sample to 200 points)
    series = _sample_queue_series(queue_events, measurement_start, measurement_end, 200)

    return ReplicationSummary(
        replication_no=replication_no,
        seed=seed,
        customers_arrived=len(records),
        customers_served=len(warm_records),
        avg_waiting_time=round(float(waits.mean()), 4),
        median_waiting_time=round(float(np.median(waits)), 4),
        p90_waiting_time=round(float(np.percentile(waits, 90)), 4),
        max_waiting_time=round(float(waits.max()), 4),
        avg_queue_length=round(avg_q, 4),
        max_queue_length=int(max_q),
        server_utilization=round(utilization, 4),
        throughput=round(throughput, 6),
        avg_system_time=round(float(system_times.mean()), 4),
        measurement_duration=round(measurement_duration, 4),
        queue_length_series=series,
        wait_histogram=histogram,
    )


def _time_weighted_queue(
    events: list[tuple[float, int]],
    start: float,
    end: float,
) -> float:
    if not events:
        return 0.0
    total_area = 0.0
    prev_time = start
    prev_q = 0
    for t, q in events:
        t = max(t, start)
        if t >= end:
            break
        total_area += prev_q * (t - prev_time)
        prev_time = t
        prev_q = q
    total_area += prev_q * (end - prev_time)
    duration = end - start
    return total_area / duration if duration > 0 else 0.0


def _sample_queue_series(
    events: list[tuple[float, int]],
    start: float,
    end: float,
    n_points: int,
) -> list[dict]:
    if not events:
        return []
    step = (end - start) / n_points
    result = []
    q = 0
    idx = 0
    for i in range(n_points):
        t = start + i * step
        while idx < len(events) and events[idx][0] <= t:
            q = events[idx][1]
            idx += 1
        result.append({"time": round(t, 2), "queue_length": q})
    return result


def aggregate_replications(summaries: list[ReplicationSummary], config: dict) -> dict:
    import scipy.stats as stats  # type: ignore

    waits = np.array([s.avg_waiting_time for s in summaries])
    n = len(summaries)

    ci = stats.t.interval(0.95, df=n - 1, loc=waits.mean(), scale=stats.sem(waits)) if n > 1 else (waits[0], waits[0])

    return {
        "replications": n,
        "avg_waiting_time": round(float(waits.mean()), 4),
        "std_waiting_time": round(float(waits.std()), 4),
        "ci_lower_waiting": round(float(ci[0]), 4),
        "ci_upper_waiting": round(float(ci[1]), 4),
        "median_waiting_time": round(float(np.median([s.median_waiting_time for s in summaries])), 4),
        "p90_waiting_time": round(float(np.mean([s.p90_waiting_time for s in summaries])), 4),
        "max_waiting_time": round(float(max(s.max_waiting_time for s in summaries)), 4),
        "avg_queue_length": round(float(np.mean([s.avg_queue_length for s in summaries])), 4),
        "max_queue_length": int(max(s.max_queue_length for s in summaries)),
        "server_utilization": round(float(np.mean([s.server_utilization for s in summaries])), 4),
        "throughput": round(float(np.mean([s.throughput for s in summaries])), 6),
        "avg_system_time": round(float(np.mean([s.avg_system_time for s in summaries])), 4),
        "customers_arrived": int(np.mean([s.customers_arrived for s in summaries])),
        "customers_served": int(np.mean([s.customers_served for s in summaries])),
        "scenario_config": config,
    }
