"""
Core SimPy discrete-event simulation model.
Single shared FIFO queue feeding N parallel counters.
"""
import simpy
import numpy as np
from app.simulation.distributions import sample_interarrival, sample_service
from app.simulation.schemas import CustomerRecord


def run_single_replication(config: dict, seed: int, replication_no: int) -> tuple[
    list[CustomerRecord], list[tuple[float, int]], float
]:
    """
    Run one replication of the queue simulation.

    Returns:
        records: per-customer event records
        queue_events: (time, queue_length) change events
        busy_time: total server-busy seconds during measurement period
    """
    n_servers: int = config["servers"]
    horizon: float = config["horizon_minutes"]
    warm_up: float = config.get("warm_up_minutes", 0.0)
    arrival_cfg: dict = config["arrival"]
    service_cfg: dict = config["service"]

    rng = np.random.default_rng(seed)
    env = simpy.Environment()
    counters = simpy.Resource(env, capacity=n_servers)

    records: list[CustomerRecord] = []
    queue_events: list[tuple[float, int]] = []
    busy_time_tracker = {"total": 0.0}

    def _record_queue():
        queue_events.append((env.now, len(counters.queue)))

    def customer(cust_no: int, arrival_time: float):
        with counters.request() as req:
            _record_queue()
            yield req
            service_start = env.now
            wait = service_start - arrival_time
            service_dur = sample_service(rng, service_cfg["distribution"], service_cfg)
            yield env.timeout(service_dur)
            service_end = env.now
            _record_queue()

            if service_end > warm_up:
                meas_start = max(service_start, warm_up)
                busy_time_tracker["total"] += service_end - meas_start

            records.append(CustomerRecord(
                customer_no=cust_no,
                arrival_time=arrival_time,
                service_start_time=service_start,
                service_end_time=service_end,
                waiting_time=wait,
                service_time=service_dur,
                system_time=service_end - arrival_time,
            ))

    def arrival_generator():
        cust_no = 0
        while True:
            iat = sample_interarrival(rng, arrival_cfg["distribution"], arrival_cfg)
            yield env.timeout(iat)
            if env.now > horizon:
                break
            cust_no += 1
            env.process(customer(cust_no, env.now))

    env.process(arrival_generator())
    # Run arrivals until horizon, then drain remaining customers
    env.run(until=horizon * 10)

    return records, queue_events, busy_time_tracker["total"]
