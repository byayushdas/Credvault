import uuid
import os
from fastapi import UploadFile, HTTPException

ALLOWED_MIME_TYPES = {
    b"%PDF-": "application/pdf",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

async def validate_and_generate_filename(file: UploadFile) -> str:
    # 1. Size check
    file.file.seek(0, 2)
    size = file.file.tell()
    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
    
    file.file.seek(0)
    
    # 2. Magic byte checking
    header = file.file.read(8)
    file.file.seek(0)
    
    valid = False
    for magic in ALLOWED_MIME_TYPES.keys():
        if header.startswith(magic):
            valid = True
            break
            
    if not valid:
        raise HTTPException(status_code=415, detail="Unsupported file format. Only PDF, PNG, JPG, JPEG are allowed.")
        
    # 3. Unique filename
    ext = os.path.splitext(file.filename)[1]
    return f"{uuid.uuid4().hex}{ext}"
