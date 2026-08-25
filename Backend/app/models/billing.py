from typing import Any
from app.schemas.billing import BillResponse
BILLS_COLLECTION="bills"; COUNTERS_COLLECTION="counters"; BILL_COUNTER_KEY="bill_id"
def bill_document_to_response(bill:dict[str,Any])->BillResponse:
    return BillResponse(**{k:v for k,v in bill.items() if k not in {"_id","is_deleted","deleted_at"}})
