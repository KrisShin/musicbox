from common.utils import get_netease_toplist
from modules.music.models import Music


async def test_save(music_list):
    """
    测试保存
    :param music_list:
    :return:
    """
    await Music.bulk_create(music_list)


if __name__ == '__main__':
    music_list = get_netease_toplist()
    test_save(music_list)
