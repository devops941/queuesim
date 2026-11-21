from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uuid


def _error_body(code: str, message: str, details=None, request_id: str | None = None):
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id or str(uuid.uuid4()),
        }
    }


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            "VALIDATION_ERROR",
            "Input validation failed",
            details=exc.errors(),
            request_id=getattr(request.state, "request_id", None),
        ),
    )


async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(
            "INTERNAL_ERROR",
            "An unexpected error occurred",
            request_id=getattr(request.state, "request_id", None),
        ),
    )


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details=None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            exc.code,
            exc.message,
            details=exc.details,
            request_id=getattr(request.state, "request_id", None),
        ),
    )
