from pymongo import MongoClient
from pymongo.database import Database

from app.config.settings import settings


# Fail fast rather than hanging on the 30s default when the database is down.
client = MongoClient(
    settings.MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
)
db: Database = client[settings.DATABASE_NAME]


def get_database() -> Database:
    """Return the configured Care-OS MongoDB database."""
    return db


def connect() -> None:
    """Verify the connection during application startup."""
    client.admin.command("ping")


def ping() -> None:
    """Raise if the database is not currently reachable."""
    client.admin.command("ping")


def close() -> None:
    """Close the client during application shutdown."""
    client.close()
