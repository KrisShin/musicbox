from pydantic import BaseModel


class SearchMusicSchema(BaseModel):
    keyword: str
