from fastapi import HTTPException, status


class AppError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, "details": details or {}},
        )


def bad_request(code: str, message: str, details: dict | None = None) -> AppError:
    return AppError(status.HTTP_400_BAD_REQUEST, code, message, details)


def unauthorized(message: str = "Authentication required") -> AppError:
    return AppError(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)


def forbidden(message: str = "Access forbidden") -> AppError:
    return AppError(status.HTTP_403_FORBIDDEN, "FORBIDDEN", message)


def not_found(resource: str = "Resource") -> AppError:
    return AppError(status.HTTP_404_NOT_FOUND, "NOT_FOUND", f"{resource} not found")


def payment_required(details: dict) -> AppError:
    return AppError(status.HTTP_402_PAYMENT_REQUIRED, "PAYMENT_REQUIRED", "Payment required", details)
