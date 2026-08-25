import re
from datetime import datetime, timezone
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from app.database.mongodb import db
from app.models.appointment import APPOINTMENTS_COLLECTION
from app.models.doctor import DOCTORS_COLLECTION
from app.models.medical_record import MEDICAL_RECORDS_COLLECTION
from app.models.patient import PATIENTS_COLLECTION
from app.models.prescription import PRESCRIPTIONS_COLLECTION
from app.models.billing import BILLS_COLLECTION, COUNTERS_COLLECTION, BILL_COUNTER_KEY, bill_document_to_response
from app.schemas.billing import BillCreate, BillUpdate, BillResponse, BillListResponse, PaymentMethod, PaymentStatus

class BillNotFoundError(Exception): pass
class BillConflictError(Exception): pass
class RelatedNotFoundError(Exception):
    def __init__(self, resource:str): self.resource=resource
def _bills(): return db[BILLS_COLLECTION]
def ensure_billing_indexes()->None:
    c=_bills(); c.create_index("bill_id",unique=True,name="unique_bill_id"); c.create_index("appointment_id",unique=True,name="unique_bill_appointment"); c.create_index("patient_id",name="bill_patient_id"); c.create_index("doctor_id",name="bill_doctor_id"); c.create_index("payment_status",name="bill_payment_status"); c.create_index("payment_method",name="bill_payment_method"); c.create_index("billing_date",name="bill_billing_date"); c.create_index("is_deleted",name="bill_is_deleted")
def _next()->str:
    c=db[COUNTERS_COLLECTION].find_one_and_update({"_id":BILL_COUNTER_KEY},{"$inc":{"sequence_value":1}},upsert=True,return_document=ReturnDocument.AFTER); return f"BILL{c['sequence_value']:06d}"
def _relations(x:dict)->None:
    for collection,field,key,label in [(APPOINTMENTS_COLLECTION,"appointment_id","appointment_id","Appointment"),(MEDICAL_RECORDS_COLLECTION,"record_id","medical_record_id","Medical record"),(PRESCRIPTIONS_COLLECTION,"prescription_id","prescription_id","Prescription"),(PATIENTS_COLLECTION,"patient_id","patient_id","Patient"),(DOCTORS_COLLECTION,"doctor_id","doctor_id","Doctor")]:
        if db[collection].find_one({field:x[key],"is_deleted":{"$ne":True}}) is None: raise RelatedNotFoundError(label)
def _total(x:dict)->float: return round(sum(float(x.get(k,0)) for k in ("consultation_fee","medicine_cost","lab_cost","other_charges","tax"))-float(x.get("discount",0)),2)
def _unique(appointment_id:str,exclude:str|None=None)->None:
    q={"appointment_id":appointment_id,"is_deleted":{"$ne":True}}
    if exclude:q["bill_id"]={"$ne":exclude}
    if _bills().find_one(q):raise BillConflictError
def create_bill(request:BillCreate)->BillResponse:
    ensure_billing_indexes(); x=request.model_dump(mode="python"); _relations(x); _unique(x["appointment_id"]); now=datetime.now(timezone.utc); x.update(bill_id=_next(),total_amount=_total(x),billing_date=now,created_at=now,updated_at=now,is_deleted=False,deleted_at=None)
    try:_bills().insert_one(x)
    except DuplicateKeyError as e:raise BillConflictError from e
    return bill_document_to_response(x)
def get_bill(bill_id:str)->BillResponse:
    x=_bills().find_one({"bill_id":bill_id,"is_deleted":{"$ne":True}})
    if not x:raise BillNotFoundError
    return bill_document_to_response(x)
def list_bills(page:int,limit:int,search:str|None,patient_id:str|None,doctor_id:str|None,appointment_id:str|None,payment_status:PaymentStatus|None,payment_method:PaymentMethod|None)->BillListResponse:
    q={"is_deleted":{"$ne":True}}
    for k,v in {"patient_id":patient_id,"doctor_id":doctor_id,"appointment_id":appointment_id,"payment_status":payment_status.value if payment_status else None,"payment_method":payment_method.value if payment_method else None}.items():
        if v:q[k]=v
    if search:
        p=re.escape(search);q["$or"]=[{k:{"$regex":p,"$options":"i"}}for k in("bill_id","appointment_id","patient_id","doctor_id","payment_status","payment_method")]
    total=_bills().count_documents(q);rows=list(_bills().find(q).sort("billing_date",-1).skip((page-1)*limit).limit(limit));pages=(total+limit-1)//limit
    return BillListResponse(total=total,page=page,limit=limit,total_pages=pages,has_next=page<pages,has_previous=page>1,data=[bill_document_to_response(x)for x in rows])
def update_bill(bill_id:str,request:BillUpdate)->BillResponse:
    old=_bills().find_one({"bill_id":bill_id,"is_deleted":{"$ne":True}})
    if not old:raise BillNotFoundError
    change=request.model_dump(exclude_unset=True,mode="python")
    if not change:return bill_document_to_response(old)
    candidate={**old,**change};_relations(candidate);_unique(candidate["appointment_id"],bill_id);change.update(total_amount=_total(candidate),updated_at=datetime.now(timezone.utc));x=_bills().find_one_and_update({"bill_id":bill_id,"is_deleted":{"$ne":True}},{"$set":change},return_document=ReturnDocument.AFTER)
    if not x:raise BillNotFoundError
    return bill_document_to_response(x)
def delete_bill(bill_id:str)->None:
    now=datetime.now(timezone.utc);x=_bills().find_one_and_update({"bill_id":bill_id,"is_deleted":{"$ne":True}},{"$set":{"is_deleted":True,"deleted_at":now,"updated_at":now}},return_document=ReturnDocument.AFTER)
    if not x:raise BillNotFoundError
