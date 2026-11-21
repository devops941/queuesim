"""
Test configuration — uses a separate test database.
"""
import os
import pytest

os.environ["MONGODB_DATABASE"] = "queuesim_test"
os.environ["JWT_SECRET"] = "test_secret_key_minimum_32_chars_long"
os.environ["REDIS_URL"] = "redis://localhost:6379/9"
