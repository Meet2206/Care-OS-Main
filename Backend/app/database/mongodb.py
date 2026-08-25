from pymongo import MongoClient
from pymongo.database import Database

from app.config.settings import settings


client = MongoClient(settings.MONGODB_URI)
db: Database = client[settings.DATABASE_NAME]


def get_database() -> Database:
    """Return the configured Care-OS MongoDB database."""
    return db


def connect() -> None:
    """Verify the connection during application startup."""
    client.admin.command("ping")


def close() -> None:
    """Close the client during application shutdown."""
    client.close()
