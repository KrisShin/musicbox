import json
from datetime import datetime
from logging import DEBUG

import httpx
from scrapy import Selector

from config.settings import NETEASE_TOPLIST
from modules.music.models import Music, MusicPlatform


def get_netease_toplist(url: str = NETEASE_TOPLIST):
    # resp = httpx.get(url)
    # selector = Selector(text=resp.text)
    # top_list_data = selector.xpath('//textarea[@id="song-list-pre-data"]/text()').extract_first()
    # if top_list_data:
    #     top_list_data = json.loads(top_list_data)
    top_list_data = []
    if DEBUG:
        with open("./top.json", "r") as f:
            top_list_data = json.loads(f.read())
    music_list = []
    for music in top_list_data:
        line = {
            'music_id': str(music['id']),
            'publish_time': datetime.fromtimestamp(music['publishTime'] / 1000)
            if music['publishTime'] > 0
            else None,
            'name': music['name'],
            'singer': ', '.join([art['name'] for art in music['artists']]),
            'platform': MusicPlatform.Netease.value,
            'album_name': music['album']['name'],
            'album_cover': music['album']['picUrl'],
            'duration': music['duration'],
        }
        music_list.append(Music(**line))
    return music_list
    ...
