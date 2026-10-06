from fastapi.responses import JSONResponse
from typing import Any

class WrappedResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        # Avoid double-wrapping if the payload already has the exact schema 
        # (e.g. from error handlers or endpoints manually returning 'success')
        if isinstance(content, dict) and "success" in content:
            return super().render(content)
            
        wrapped_content = {
            "success": True,
            "data": content
        }
        return super().render(wrapped_content)
