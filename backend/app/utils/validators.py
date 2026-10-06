def validate_document_type(doc_type: str) -> bool:
    allowed = ["ID_CARD", "DEGREE", "DRIVING_LICENCE", "PASSPORT", "PAN"]
    return doc_type in allowed
