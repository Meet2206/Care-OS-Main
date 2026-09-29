from typing import Any

ADVANCE_PAYMENTS_COLLECTION = "advance_payments"
COUNTERS_COLLECTION = "counters"
ADVANCE_PAYMENT_COUNTER_KEY = "advance_payment_id"


def advance_payment_document_to_response(payment: dict[str, Any]):
    from app.schemas.advance_payment import AdvancePaymentResponse

    return AdvancePaymentResponse(**{key: value for key, value in payment.items() if key != "_id"})
