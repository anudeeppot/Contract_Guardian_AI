from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user
from app.db.models import Contract, User
from app.db.session import get_db
from app.schemas.contracts import ContractResponse, ContractTextResponse, UploadResponse
from app.services.contracts import ContractService

router = APIRouter(prefix="/contracts", tags=["Contracts"])


def contract_response(contract: Contract) -> ContractResponse:
    return ContractResponse(
        id=str(contract.id),
        original_filename=contract.original_filename,
        file_type=contract.file_type,
        file_size_bytes=contract.file_size_bytes,
        status=contract.status,
        page_count=contract.page_count,
        word_count=contract.word_count,
        parse_warnings=contract.parse_warnings or [],
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_contract(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = await ContractService(db).upload(user.id, file)
    return UploadResponse(contract=contract_response(contract))


@router.post("/{contract_id}/extract-text", response_model=ContractResponse)
async def extract_text(
    contract_id: UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ContractService(db)
    contract = await service.get_owned(contract_id, user.id)
    return contract_response(await service.extract_text(contract))


@router.get("", response_model=list[ContractResponse])
async def list_contracts(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return [contract_response(item) for item in await ContractService(db).list_owned(user.id)]


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    return contract_response(await ContractService(db).get_owned(contract_id, user.id))


@router.get("/{contract_id}/text", response_model=ContractTextResponse)
async def get_contract_text(
    contract_id: UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = await ContractService(db).get_owned(contract_id, user.id)
    return ContractTextResponse(contract_id=str(contract.id), text=contract.extracted_text or "")


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(
    contract_id: UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await ContractService(db).delete_owned(contract_id, user.id)
