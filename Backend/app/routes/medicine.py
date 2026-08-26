from __future__ import annotations
import csv
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.schemas.auth import UserResponse
from app.utils.security import require_roles

router = APIRouter(prefix="/medicines", tags=["Medicines"])
CatalogUser = Annotated[UserResponse, Depends(require_roles("doctor"))]
CATALOG_PATH = Path(__file__).resolve().parents[3] / "Dataset" / "Medicine_Details.csv"


def _catalog_rows(search: str | None, limit: int) -> list[dict[str, str]]:
    normalized = (search or "").strip().lower()
    results = []
    with CATALOG_PATH.open(newline="", encoding="utf-8") as catalog:
        for index, row in enumerate(csv.DictReader(catalog), start=1):
            name = (row.get("Medicine Name") or "").strip()
            composition = (row.get("Composition") or "").strip()
            if normalized and normalized not in name.lower() and normalized not in composition.lower():
                continue
            results.append({"medicine_id": f"MED{index:06d}", "medicine_name": name, "composition": composition})
            if len(results) >= limit:
                break
    return results


@router.get("/search")
def search_medicines(
    _: CatalogUser,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict[str, list[dict[str, str]]]:
    return {"data": _catalog_rows(q, limit)}
