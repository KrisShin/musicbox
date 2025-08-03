from fastapi import FastAPI, Response
from fastapi.responses import Response
from scrapy import Selector
import uvicorn
import httpx

from schema import SearchMusicSchema

app = FastAPI()

BASE_URL = 'https://www.gequhai.net'

client = httpx.Client(base_url=BASE_URL)


@app.get('/test/')
def get_test():
    return Response('hello')


@app.post('/search/')
def post_search_music(params: SearchMusicSchema):
    resp = client.get(f'/s/{params.keyword}')
    selector = Selector(text=resp.text)
    pass
    return {'keyword': params.keyword}


if __name__ == '__main__':
    uvicorn.run(app, port=9999)
