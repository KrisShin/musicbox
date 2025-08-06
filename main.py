import re
from urllib.parse import parse_qs, urlparse
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from parsel import Selector
import uvicorn
import httpx

from schema import BASE_URL, DownloadMusicSchema, MusicListRowSchema, SearchMusicResponseSchema, SearchMusicSchema, MusicDetailResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # expose_headers=["*"],
)

headers = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'cache-control': 'no-cache',
    'dnt': '1',
    'pragma': 'no-cache',
    'priority': 'u=0, i',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
}


client = httpx.Client(base_url=BASE_URL, headers=headers, follow_redirects=True)

TRY_LIMIT = 3


@app.get('/test/')
def get_test():
    return Response('hello')


@app.post('/search/')
def post_search_music(params: SearchMusicSchema):
    try:
        resp = client.get(f'/s/{params.keyword}', params={'page': params.page}, timeout=15)
        resp.raise_for_status()  # 如果请求失败 (例如 404, 500), 会抛出异常
    except httpx.HTTPStatusError as e:
        # 返回一个空的、没有更多页的响应，并可以在日志中记录错误
        print(f"请求失败: {e}")
        return SearchMusicResponseSchema(data=[], has_more=False)

    selector = Selector(text=resp.text)
    song_rows = selector.css('div.row')
    music_list = []

    for row in song_rows:
        title = row.css('span.music-title > span::text').get()
        artist = row.css('small.text-jade::text').get()
        url = row.css('a.music-link::attr(href)').get()

        if not (title and artist and url):
            # 如果核心数据不完整，跳过此条目
            continue

        try:
            parsed_url = urlparse(url)
            query_params = parse_qs(parsed_url.query)
            song_id = query_params.get('song_id', [None])[0]

            if song_id:
                music_list.append(
                    MusicListRowSchema(
                        song_id=song_id,
                        title=title.strip(),
                        artist=artist.strip(),
                        url=url,  # 传入完整的相对URL
                    )
                )
        except (IndexError, TypeError):
            print(f"URL解析失败，跳过: {url}")
            continue

    # --- 判断是否还有下一页 ---
    # 选取分页组件中的最后一个列表项
    last_page_item = selector.css('ul.pagination li.page-item:last-child')
    has_more = True
    if last_page_item:
        # 如果最后一个分页项存在，并且它包含 'disabled' 类，则说明没有下一页了
        if 'disabled' in last_page_item.attrib.get('class', ''):
            has_more = False
    else:
        # 如果页面上根本没有分页组件（例如只有一页内容），也认为没有下一页
        has_more = False

    return SearchMusicResponseSchema(data=music_list, has_more=has_more)


@app.post('/detail/')
def post_detail_music(params: DownloadMusicSchema):
    try_times = 0
    while True:
        try:
            try_times += 1
            resp = client.get(params.url, timeout=15)
            resp.raise_for_status()  # 如果请求失败 (例如 404, 500), 会抛出异常
            break
        except httpx.HTTPStatusError as e:
            # 返回一个空的、没有更多页的响应，并可以在日志中记录错误
            print(f"请求失败: {e}")
            raise Response(status_code=status.HTTP_400_BAD_REQUEST, content=f"code: {resp.status_code}, text: {resp.text}")
        except httpx.ReadTimeout:
            if try_times >= TRY_LIMIT:
                raise Response(status_code=status.HTTP_400_BAD_REQUEST, content=f"内容获取超时")

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
    duration = duration_match.group(1) if duration_match else None  # like '04:57'
    min, sec = [int(x) for x in duration.split(':')]
    duration = min * 60 + sec

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

    resp = client.get('/api/down_mp3/40765')
    print(resp.headers['content-type'])

    # 4. 构造并返回响应
    return MusicDetailResponse(
        cover_url=cover_url,
        lyric=lyric.strip(),
        duration=duration,
        download_mp3_id=download_mp3_id,
    )


if __name__ == '__main__':
    uvicorn.run(app, port=9999)
