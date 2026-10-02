from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ContractResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    status: str
    page_count: int | None = None
    word_count: int | None = None
    parse_warnings: list = []
    created_at: datetime
    updated_at: datetime


class ContractTextResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    contract_id: str
    text: str


class UploadResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    contract: ContractResponse
