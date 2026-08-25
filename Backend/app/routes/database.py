from typing import Annotated

from fastapi import APIRouter, Depends

from app.database.mongodb import db
from app.schemas.auth import UserResponse
from app.utils.security import require_admin

router = APIRouter(tags=["Database"])


@router.get("/db-test")
def db_test(_: Annotated[UserResponse, Depends(require_admin)]) -> dict[str, str | list[str]]:
    collections = db.list_collection_names()

    return {
        "status": "Connected",
        "collections": collections,
    }
