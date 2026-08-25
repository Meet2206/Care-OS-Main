from typing import Annotated
from fastapi import APIRouter,Depends,Query,Response,status
from app.controllers import billing_controller
from app.schemas.auth import UserResponse
from app.schemas.billing import BillCreate,BillUpdate,BillResponse,BillListResponse,PaymentStatus,PaymentMethod
from app.utils.security import require_patient_ownership, require_roles
router=APIRouter(prefix="/bills",tags=["Billing & Payments"])
User=Annotated[UserResponse,Depends(require_roles("doctor", "pharmacy", "patient", "receptionist", "admin"))]
@router.post("",response_model=BillResponse,status_code=201)
def create_bill(x:BillCreate,_:User):return billing_controller.create(x)
@router.get("",response_model=BillListResponse)
def list_bills(current_user:User,page:int=Query(1,ge=1),limit:int=Query(10,ge=1,le=100),search:str|None=None,patient_id:str|None=None,doctor_id:str|None=None,appointment_id:str|None=None,payment_status:PaymentStatus|None=Query(None,alias="payment_status"),payment_method:PaymentMethod|None=Query(None,alias="payment_method")):
    if current_user.role.value == "patient":
        if not current_user.patient_id:
            return {"total": 0, "page": page, "limit": limit, "total_pages": 0, "has_next": False, "has_previous": False, "data": []}
        patient_id = current_user.patient_id
    return billing_controller.list_all(page,limit,search,patient_id,doctor_id,appointment_id,payment_status,payment_method)
@router.get("/{bill_id}",response_model=BillResponse)
def get_bill(bill_id:str,current_user:User):
    bill=billing_controller.get_one(bill_id)
    require_patient_ownership(current_user, bill.patient_id)
    return bill
@router.put("/{bill_id}",response_model=BillResponse)
def update_bill(bill_id:str,x:BillUpdate,current_user:User):
    bill=billing_controller.get_one(bill_id)
    require_patient_ownership(current_user, bill.patient_id)
    return billing_controller.update(bill_id,x)
@router.delete("/{bill_id}",status_code=204)
def delete_bill(bill_id:str,current_user:User):
    bill=billing_controller.get_one(bill_id)
    require_patient_ownership(current_user, bill.patient_id)
    billing_controller.delete(bill_id)
    return Response(status_code=204)
