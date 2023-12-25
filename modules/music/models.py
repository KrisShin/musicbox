from enum import Enum, IntEnum

from tortoise import fields

from common.models import BaseModel


class MusicPlatform(str, Enum):
    QQ: str = "QQ"
    Netease: str = "Netease"
    Kugou: str = "Kugou"
    Xiami: str = "Xiami"
    Baidu: str = "Baidu"
    Kuwo: str = "Kuwo"
    Migu: str = "Migu"
    Jingting: str = "Jingting"
    Mi: str = "Mi"


class MusicQuality(IntEnum):
    # 128k
    LQ = 128
    # 192k
    HQ = 192
    # 320k
    SQ = 320
    # loseless
    LL = 999


class MusicFormat(str, Enum):
    MP3: str = 'mp3'
    M4A: str = 'm4a'
    FLAC: str = 'flac'
    APE: str = 'ape'
    WAV: str = 'wav'
    OGG: str = 'ogg'
    WMA: str = 'wma'
    AIFF: str = 'aiff'


class Music(BaseModel):
    name = fields.CharField(max_length=128)
    platform = fields.CharEnumField(
        MusicPlatform, default=MusicPlatform.QQ, description="music from witch platform"
    )
    url = fields.CharField(max_length=512, description="music url", unique=True)
    is_valid = fields.BooleanField(default=True, description="is valid")
    quality = fields.IntEnumField(
        MusicQuality, default=MusicQuality.LQ, description="music quality"
    )
    is_support_download = fields.BooleanField(
        default=False, description="is support download"
    )
    download_count = fields.IntField(default=0, description="download count")
    play_count = fields.IntField(default=0, description="play count")
    format = fields.CharEnumField(
        MusicFormat, default=MusicFormat.MP3, description="music format"
    )
    publish_time = fields.DatetimeField(description="publish time", null=True)
    singer = fields.CharField(max_length=128, description="singer", null=True)
    album_cover = fields.CharField(max_length=512, description="cover", null=True)
    album_name = fields.CharField(max_length=128, description="album", null=True)
    duration = fields.FloatField(default=0, description="duration")
    music_id = fields.CharField(max_length=128, description="music id")

    class Meta:
        table = "tb_music"
        ordering = ['-play_count', 'create_time']
        unique_together = ('platform', 'music_id')


class Lyric(BaseModel):
    """
    lyric model
    """

    lyric = fields.TextField(description="lyric")
    music = fields.OneToOneField(
        "models.Music", related_name="lyric", description="music"
    )

    class Meta:
        table = "tb_lyric"
