import re
from urllib.parse import parse_qs, urlparse
from fastapi import FastAPI, Response
from fastapi.responses import Response
from parsel import Selector
import uvicorn
import httpx

from schema import BASE_URL, DownloadMusicSchema, MusicListRowSchema, SearchMusicSchema, MusicDetailResponse

app = FastAPI()


client = httpx.Client(base_url=BASE_URL)


@app.get('/test/')
def get_test():
    return Response('hello')


@app.post('/search/')
def post_search_music(params: SearchMusicSchema):
    resp = client.get(f'/s/{params.keyword}?page={params.page}')

    # 2. 使用 parsel 创建选择器对象
    selector = Selector(text=resp.text)

    # 3. 选取所有包含歌曲信息的 div.row
    song_rows = selector.css('div.row')

    music_list = []
    # 4. 遍历每一个歌曲条目
    for row in song_rows:
        # 使用 CSS 选择器精确定位并提取数据
        # .get() 会返回第一个匹配项，如果没有找到则返回 None
        title = row.css('span.music-title > span::text').get()
        artist = row.css('small.text-jade::text').get()
        url = row.css('a.music-link::attr(href)').get()

        # 5. 确保所有需要的数据都成功提取到了
        if title and artist and url:
            try:
                # 6. 从 URL 中安全地解析出 song_id
                parsed_url = urlparse(url)
                query_params = parse_qs(parsed_url.query)
                # .get('song_id', [None]) 提供了默认值以防 'song_id' 不存在
                song_id = query_params.get('song_id', [None])[0]

                if song_id:
                    # 7. 将提取并清洗后的数据添加到列表中
                    music_list.append(
                        MusicListRowSchema(
                            song_id=song_id,
                            title=title.strip(),  # .strip() 用于去除可能存在的多余空格
                            artist=artist.strip(),
                            url=url,
                        )
                    )
            except (IndexError, TypeError):
                # 如果URL解析失败，则跳过此条目
                continue
    return music_list


@app.post('/download/')
def post_download_music(params: DownloadMusicSchema):
    resp = client.get(params.url)
    selector = Selector(text=resp.text)

    # 3. 提取各个信息

    # 提取封面URL
    cover_url = selector.css('meta[property="og:image"]::attr(content)').get()

    # 提取歌词
    # .get() 获取的是带 <br> 的 HTML，我们将其替换为换行符
    lyric_html = selector.css('div#content-lrc').get()
    lyric = ""
    if lyric_html:
        # 使用 parsel 再次解析，并提取所有文本节点，用换行符连接
        lyric_selector = Selector(text=lyric_html)
        lyric = "\n".join(lyric_selector.css('::text').getall())

    # 提取时长 (使用正则表达式)
    duration_match = re.search(r"innerHTML = '.*?(\d{2}:\d{2}).*?'", resp.text)
    duration = duration_match.group(1) if duration_match else None

    # 提取下载ID (使用正则表达式)
    app_data_match = re.search(r"window\.appData = (\{.*?\});", resp.text)
    download_mp3_id = None
    if app_data_match:
        import json

        try:
            app_data = json.loads(app_data_match.group(1))
            download_mp3_id = app_data.get('mp3_id')
        except json.JSONDecodeError:
            download_mp3_id = None

    # 4. 构造并返回响应
    return MusicDetailResponse(
        cover_url=cover_url,
        lyric=lyric.strip(),
        duration=duration,
        download_mp3_id=download_mp3_id,
    )


if __name__ == '__main__':
    uvicorn.run(app, port=9999)
