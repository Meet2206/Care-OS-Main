from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

class PaymentStatus(str, Enum): pending="Pending"; paid="Paid"; cancelled="Cancelled"; refunded="Refunded"
class PaymentMethod(str, Enum): cash="Cash"; card="Card"; upi="UPI"; net_banking="Net Banking"; insurance="Insurance"
class BillBase(BaseModel):
    appointment_id: str; medical_record_id: str; prescription_id: str; patient_id: str; doctor_id: str
    consultation_fee: float=Field(0,ge=0); medicine_cost: float=Field(0,ge=0); lab_cost: float=Field(0,ge=0); other_charges: float=Field(0,ge=0); discount: float=Field(0,ge=0); tax: float=Field(0,ge=0)
    payment_status: PaymentStatus=PaymentStatus.pending; payment_method: PaymentMethod=PaymentMethod.cash; remarks: str|None=Field(None,max_length=1000)
class BillCreate(BillBase): pass
class BillUpdate(BaseModel):
    appointment_id:str|None=None; medical_record_id:str|None=None; prescription_id:str|None=None; patient_id:str|None=None; doctor_id:str|None=None
    consultation_fee:float|None=Field(None,ge=0); medicine_cost:float|None=Field(None,ge=0); lab_cost:float|None=Field(None,ge=0); other_charges:float|None=Field(None,ge=0); discount:float|None=Field(None,ge=0); tax:float|None=Field(None,ge=0)
    payment_status:PaymentStatus|None=None; payment_method:PaymentMethod|None=None; remarks:str|None=Field(None,max_length=1000)
class BillResponse(BillBase): bill_id:str; total_amount:float; billing_date:datetime; created_at:datetime; updated_at:datetime
class BillListResponse(BaseModel): total:int; page:int; limit:int; total_pages:int; has_next:bool; has_previous:bool; data:list[BillResponse]
class BillErrorResponse(BaseModel): detail:str
