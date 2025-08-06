from typing import List, Optional
from pydantic import BaseModel, Field, computed_field

BASE_URL = 'https://www.gequbao.com'


class SearchMusicSchema(BaseModel):
    keyword: str
    page: Optional[int] = 1


class MusicListRowSchema(BaseModel):
    title: str
    artist: str
    url: str
    song_id: str | int


class SearchMusicResponseSchema(BaseModel):
    data: List[MusicListRowSchema]
    has_more: bool


class DownloadMusicSchema(BaseModel):
    url: str


class MusicDetailResponse(BaseModel):
    cover_url: Optional[str] = Field(None, description="歌曲封面图片URL")
    lyric: Optional[str] = Field(None, description="LRC格式的歌词文本")
    duration: Optional[str] = Field(None, description="歌曲时长，格式为 mm:ss")
    download_mp3_id: Optional[int] = Field(None, description="用于构造下载链接的ID")

    @computed_field
    @property
    def download_mp3(self) -> str:
        return f'{BASE_URL}/api/down_mp3/{self.download_mp3_id}'

    @computed_field
    @property
    def download_kuake(self) -> str:
        return f'{BASE_URL}/api/down_url/{self.download_mp3_id}'
