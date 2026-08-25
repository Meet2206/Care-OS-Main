from fastapi import HTTPException, status
from app.schemas.billing import BillCreate, BillUpdate
from app.services import billing_service
def _error(e:Exception):
    if isinstance(e,billing_service.RelatedNotFoundError): detail=f"{e.resource} not found."
    else: detail="Bill not found."
    return HTTPException(status_code=404,detail=detail)
def create(x:BillCreate):
    try:return billing_service.create_bill(x)
    except billing_service.RelatedNotFoundError as e:raise _error(e) from e
    except billing_service.BillConflictError as e:raise HTTPException(status_code=409,detail="Bill already exists for this appointment.") from e
def get_one(i:str):
    try:return billing_service.get_bill(i)
    except billing_service.BillNotFoundError as e:raise _error(e) from e
def list_all(*args):return billing_service.list_bills(*args)
def update(i:str,x:BillUpdate):
    try:return billing_service.update_bill(i,x)
    except (billing_service.BillNotFoundError,billing_service.RelatedNotFoundError) as e:raise _error(e) from e
    except billing_service.BillConflictError as e:raise HTTPException(status_code=409,detail="Bill already exists for this appointment.") from e
def delete(i:str):
    try:billing_service.delete_bill(i)
    except billing_service.BillNotFoundError as e:raise _error(e) from e
