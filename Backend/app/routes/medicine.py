from __future__ import annotations
import csv
import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.auth import UserResponse, UserRole
from app.utils.security import require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/medicines", tags=["Medicines"])
# Receptionists reconcile pharmacy paperwork, so they need lookup as well.
CatalogUser = Annotated[
    UserResponse, Depends(require_roles(UserRole.doctor, UserRole.receptionist, UserRole.admin))
]
CATALOG_FILENAME = "Medicine_Details.csv"


def _catalog_candidates() -> list[Path]:
    here = Path(__file__).resolve()
    return [
        here.parents[3] / "Dataset" / CATALOG_FILENAME,  # repository checkout
        here.parents[2] / "Dataset" / CATALOG_FILENAME,  # Backend-only deployment
        Path.cwd() / "Dataset" / CATALOG_FILENAME,
    ]


@lru_cache(maxsize=1)
def _catalog() -> list[dict[str, str]]:
    """Load the medicine catalogue once per process.

    Previously every search re-read and re-parsed the full 11k-row CSV from
    disk. The file is static, so it is parsed a single time and cached.
    """
    for path in _catalog_candidates():
        if not path.is_file():
            continue
        with path.open(newline="", encoding="utf-8") as handle:
            rows = []
            for index, row in enumerate(csv.DictReader(handle), start=1):
                name = (row.get("Medicine Name") or "").strip()
                if not name:
                    continue
                rows.append(
                    {
                        "medicine_id": f"MED{index:06d}",
                        "medicine_name": name,
                        "composition": (row.get("Composition") or "").strip(),
                        "_haystack": f"{name}\n{row.get('Composition') or ''}".lower(),
                    }
                )
        logger.info("Medicine catalogue loaded: %d entries", len(rows))
        return rows
    logger.error("Medicine catalogue file was not found")
    return []


def _search(query: str | None, limit: int) -> list[dict[str, str]]:
    rows = _catalog()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The medicine catalogue is unavailable.",
        )
    normalized = (query or "").strip().lower()
    if not normalized:
        matches = rows[:limit]
    else:
        # Rank name-prefix matches ahead of substring and composition matches so
        # a type-ahead surfaces the obvious candidate first.
        prefix, contains, composition = [], [], []
        for row in rows:
            name = row["medicine_name"].lower()
            if name.startswith(normalized):
                prefix.append(row)
            elif normalized in name:
                contains.append(row)
            elif normalized in row["_haystack"]:
                composition.append(row)
            if len(prefix) >= limit:
                break
        matches = (prefix + contains + composition)[:limit]
    return [
        {k: v for k, v in row.items() if not k.startswith("_")} for row in matches
    ]


@router.get("/search", summary="Search the medicine catalogue")
def search_medicines(
    _: CatalogUser,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict[str, list[dict[str, str]]]:
    return {"data": _search(q, limit)}
