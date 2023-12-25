from fastapi import APIRouter
from common.pydantics import Reseponse

from common.utils import get_netease_toplist
from modules.music.models import Music


router = APIRouter()

@router.get("/netease/top-list")
async def get_netease_top_list():
    top_list = get_netease_toplist()
    await Music.bulk_create(top_list, batch_size=30, ignore_conflicts=True)
    return Reseponse()