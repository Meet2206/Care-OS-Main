"""Helpers for turning stored documents into API responses."""
from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


def serialize_documents(
    documents: Iterable[dict[str, Any]],
    convert: Callable[[dict[str, Any]], T],
    *,
    identifier_field: str,
) -> list[T]:
    """Convert documents to response models, skipping any that fail validation.

    A single malformed row — from a migration, a manual fix, or an older schema
    version — should not take down a whole list endpoint with a 500. Bad rows are
    logged and omitted so the rest of the page still renders.
    """
    results: list[T] = []
    for document in documents:
        try:
            results.append(convert(document))
        except Exception:
            logger.exception(
                "Skipped an unreadable document in a list response",
                extra={"identifier": str(document.get(identifier_field, "unknown"))},
            )
    return results
