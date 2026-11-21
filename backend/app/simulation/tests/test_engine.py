"""
pytest tests for the simulation engine.
Tests cover: low-load (near-zero wait), high-load (wait > 0), server scaling,
reproducibility, and zero-division safety with empty horizon.
"""
import pytest
from app.simulation.replications import run_simulation


def _make_config(
    servers: int = 1,
    horizon_minutes: float = 120.0,
    warm_up_minutes: float = 0.0,
    replications: int = 3,
    seed: int = 99,
    arrival_dist: str = "fixed",
    arrival_mean: float = 10.0,
    service_dist: str = "fixed",
    service_mean: float = 5.0,
) -> dict:
    return {
        "servers": servers,
        "horizon_minutes": horizon_minutes,
        "warm_up_minutes": warm_up_minutes,
        "replications": replications,
        "seed": seed,
        "arrival": {"distribution": arrival_dist, "mean": arrival_mean},
        "service": {"distribution": service_dist, "mean": service_mean},
    }


class TestLowLoadNearZeroWait:
    """When arrival rate << service rate, avg wait should be near zero."""

    def test_fixed_arrival_much_larger_than_service(self):
        # arrival every 10 min, service takes 2 min — 1 server easily handles load
        config = _make_config(
            servers=1,
            arrival_dist="fixed",
            arrival_mean=10.0,
            service_dist="fixed",
            service_mean=2.0,
            horizon_minutes=120,
            replications=3,
        )
        result = run_simulation(config)
        assert result["avg_waiting_time"] >= 0.0
        # With fixed arrivals every 10 min and 2-min service, utilization ~20%
        # so virtually no queuing
        assert result["avg_waiting_time"] < 1.0, (
            f"Expected near-zero wait for low load but got {result['avg_waiting_time']}"
        )

    def test_server_utilization_low_load(self):
        config = _make_config(
            servers=1,
            arrival_dist="fixed",
            arrival_mean=10.0,
            service_dist="fixed",
            service_mean=2.0,
            horizon_minutes=120,
            replications=3,
        )
        result = run_simulation(config)
        assert 0.0 <= result["server_utilization"] <= 1.0
        assert result["server_utilization"] < 0.5


class TestHighLoadQueueForms:
    """When arrival rate > service rate, a queue should form with avg_wait > 0."""

    def test_exponential_high_load_queue(self):
        # mean_interarrival = 2 min, mean_service = 3 min → rho = 1.5 > 1 for 1 server
        config = _make_config(
            servers=1,
            arrival_dist="exponential",
            arrival_mean=2.0,
            service_dist="exponential",
            service_mean=3.0,
            horizon_minutes=120,
            replications=3,
            seed=42,
        )
        result = run_simulation(config)
        assert result["avg_waiting_time"] > 0.0, (
            f"Expected positive wait time under high load but got {result['avg_waiting_time']}"
        )
        assert result["avg_queue_length"] > 0.0
        assert result["customers_arrived"] > 0

    def test_fixed_high_load_produces_queue(self):
        # arrival every 1 min, fixed service 2 min — queue grows indefinitely
        config = _make_config(
            servers=1,
            arrival_dist="fixed",
            arrival_mean=1.0,
            service_dist="fixed",
            service_mean=2.0,
            horizon_minutes=120,
            replications=3,
            seed=7,
        )
        result = run_simulation(config)
        assert result["avg_waiting_time"] > 0.0


class TestMoreServersReducesWait:
    """Adding servers under the same load should reduce average waiting time."""

    def test_two_servers_less_wait_than_one(self):
        base_config = dict(
            arrival_dist="exponential",
            arrival_mean=2.0,
            service_dist="exponential",
            service_mean=3.0,
            horizon_minutes=120,
            replications=5,
            seed=123,
        )
        config_1 = _make_config(servers=1, **base_config)
        config_3 = _make_config(servers=3, **base_config)

        result_1 = run_simulation(config_1)
        result_3 = run_simulation(config_3)

        assert result_3["avg_waiting_time"] < result_1["avg_waiting_time"], (
            f"3 servers ({result_3['avg_waiting_time']:.4f}) should wait less than "
            f"1 server ({result_1['avg_waiting_time']:.4f})"
        )

    def test_server_utilization_decreases_with_more_servers(self):
        base_config = dict(
            arrival_dist="exponential",
            arrival_mean=2.0,
            service_dist="exponential",
            service_mean=3.0,
            horizon_minutes=120,
            replications=3,
            seed=456,
        )
        config_1 = _make_config(servers=1, **base_config)
        config_4 = _make_config(servers=4, **base_config)

        result_1 = run_simulation(config_1)
        result_4 = run_simulation(config_4)

        assert result_4["server_utilization"] <= result_1["server_utilization"]


class TestReproducibility:
    """Same seed must produce identical avg_waiting_time."""

    def test_same_seed_same_result(self):
        config = _make_config(
            servers=2,
            arrival_dist="exponential",
            arrival_mean=3.0,
            service_dist="exponential",
            service_mean=2.5,
            horizon_minutes=120,
            replications=5,
            seed=2024,
        )
        result_a = run_simulation(config)
        result_b = run_simulation(config)

        assert result_a["avg_waiting_time"] == result_b["avg_waiting_time"], (
            f"Results differ with same seed: "
            f"{result_a['avg_waiting_time']} vs {result_b['avg_waiting_time']}"
        )

    def test_different_seed_may_differ(self):
        base = dict(
            servers=1,
            arrival_dist="exponential",
            arrival_mean=3.0,
            service_dist="exponential",
            service_mean=2.5,
            horizon_minutes=120,
            replications=5,
        )
        config_a = _make_config(**base, seed=1)
        config_b = _make_config(**base, seed=999)

        result_a = run_simulation(config_a)
        result_b = run_simulation(config_b)

        # They CAN be equal by coincidence but are almost always different
        # We just check both are valid non-negative numbers
        assert result_a["avg_waiting_time"] >= 0.0
        assert result_b["avg_waiting_time"] >= 0.0


class TestZeroDivisionSafety:
    """Very short horizon with no customers should return valid zero metrics."""

    def test_very_short_horizon_no_customers(self):
        # With arrival every 100 min and horizon of 1 min, 0 customers arrive
        config = _make_config(
            servers=1,
            arrival_dist="fixed",
            arrival_mean=100.0,
            service_dist="fixed",
            service_mean=5.0,
            horizon_minutes=1.0,
            warm_up_minutes=0.0,
            replications=3,
            seed=0,
        )
        result = run_simulation(config)

        assert result["avg_waiting_time"] >= 0.0
        assert result["avg_queue_length"] >= 0.0
        assert 0.0 <= result["server_utilization"] <= 1.0
        assert result["replications"] == 3

    def test_zero_warm_up_full_horizon(self):
        config = _make_config(
            servers=2,
            arrival_dist="exponential",
            arrival_mean=5.0,
            service_dist="exponential",
            service_mean=4.0,
            horizon_minutes=120.0,
            warm_up_minutes=0.0,
            replications=3,
            seed=55,
        )
        result = run_simulation(config)
        # Must have all required keys
        required_keys = [
            "avg_waiting_time",
            "std_waiting_time",
            "avg_queue_length",
            "server_utilization",
            "throughput",
            "replications",
        ]
        for key in required_keys:
            assert key in result, f"Missing key '{key}' in simulation result"
        assert result["avg_waiting_time"] >= 0.0
        assert result["replications"] == 3
