import shutil
from hashlib import sha256 as sha256_digest
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ContractStatus, FileType
from app.core.errors import bad_request, not_found
from app.db.models import Contract
from app.repositories.contracts import ContractRepository
from app.services.document_parser import DocumentParserService


class ContractService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.contracts = ContractRepository(db)
        self.parser = DocumentParserService()

    async def upload(self, user_id: UUID, file: UploadFile) -> Contract:
        extension = Path(file.filename or "").suffix.lower().lstrip(".")
        if extension not in settings.allowed_upload_extensions:
            raise bad_request(
                "UNSUPPORTED_FILE_TYPE",
                "Only PDF, DOCX, and TXT files are supported",
                {"allowed": settings.allowed_upload_extensions},
            )
        file_type = FileType(extension.upper()).value
        target = settings.upload_dir / str(user_id) / f"{uuid4()}.{extension}"
        target.parent.mkdir(parents=True, exist_ok=True)
        size = 0
        hasher = sha256_digest()
        first_bytes = b""
        with target.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                if not first_bytes:
                    first_bytes = chunk[:16]
                size += len(chunk)
                if size > settings.max_upload_size_bytes:
                    target.unlink(missing_ok=True)
                    raise bad_request("FILE_TOO_LARGE", "Uploaded file exceeds size limit")
                hasher.update(chunk)
                out.write(chunk)
        if size == 0:
            target.unlink(missing_ok=True)
            raise bad_request("EMPTY_FILE", "Uploaded file is empty")
        self._validate_signature(extension, first_bytes, target)
        contract = await self.contracts.create(
            Contract(
                user_id=user_id,
                original_filename=file.filename or target.name,
                file_type=file_type,
                storage_path=str(target),
                file_size_bytes=size,
                sha256=hasher.hexdigest(),
            )
        )
        await self.db.commit()
        return contract

    async def extract_text(self, contract: Contract) -> Contract:
        contract.status = ContractStatus.PARSING.value
        await self.db.flush()
        parsed = await self.parser.parse(Path(contract.storage_path), contract.file_type)
        contract.extracted_text = parsed.text
        contract.page_count = parsed.page_count
        contract.word_count = parsed.word_count
        contract.parse_warnings = parsed.warnings
        contract.status = ContractStatus.PARSED.value
        await self.db.commit()
        return contract

    async def get_owned(self, contract_id: UUID, user_id: UUID) -> Contract:
        contract = await self.contracts.get_owned(contract_id, user_id)
        if not contract:
            raise not_found("Contract")
        return contract

    async def list_owned(self, user_id: UUID) -> list[Contract]:
        return await self.contracts.list_owned(user_id)

    async def delete_owned(self, contract_id: UUID, user_id: UUID) -> None:
        contract = await self.get_owned(contract_id, user_id)
        storage_path = Path(contract.storage_path)
        await self.contracts.delete(contract)
        await self.db.commit()
        storage_path.unlink(missing_ok=True)
        empty_parent = storage_path.parent
        if empty_parent.exists():
            try:
                shutil.rmtree(empty_parent)
            except OSError:
                pass

    def _validate_signature(self, extension: str, first_bytes: bytes, target: Path) -> None:
        if extension == "pdf" and not first_bytes.startswith(b"%PDF"):
            target.unlink(missing_ok=True)
            raise bad_request("INVALID_FILE_SIGNATURE", "PDF file signature is invalid")
        if extension == "docx" and not first_bytes.startswith(b"PK"):
            target.unlink(missing_ok=True)
            raise bad_request("INVALID_FILE_SIGNATURE", "DOCX file signature is invalid")
        if extension == "txt" and b"\x00" in first_bytes:
            target.unlink(missing_ok=True)
            raise bad_request("INVALID_FILE_SIGNATURE", "TXT file appears to contain binary content")
