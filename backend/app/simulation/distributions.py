"""
Sampling functions for arrival and service time distributions.
All times are in minutes.
"""
import numpy as np
from numpy.random import Generator


def sample_interarrival(rng: Generator, distribution: str, params: dict) -> float:
    """Return next inter-arrival time in minutes (always > 0)."""
    if distribution == "fixed":
        return float(params["mean_interarrival"])
    if distribution == "exponential":
        return float(rng.exponential(scale=params["mean_interarrival"]))
    raise ValueError(f"Unknown arrival distribution: {distribution}")


def sample_service(rng: Generator, distribution: str, params: dict) -> float:
    """Return service duration in minutes (always > 0)."""
    if distribution == "fixed":
        v = float(params["mean"])
        return max(v, 1e-9)

    if distribution == "exponential":
        v = float(rng.exponential(scale=params["mean"]))
        return max(v, 1e-9)

    if distribution == "normal":
        mean = float(params["mean"])
        std = float(params["std_dev"])
        for _ in range(50):
            v = float(rng.normal(loc=mean, scale=std))
            if v > 0:
                return v
        return mean

    if distribution == "uniform":
        lo = float(params["min_time"])
        hi = float(params["max_time"])
        return float(rng.uniform(low=lo, high=hi))

    raise ValueError(f"Unknown service distribution: {distribution}")
