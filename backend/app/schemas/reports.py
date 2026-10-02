from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class DownloadReportRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    analysis_id: str
    format: str = "json"
