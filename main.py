from fastapi import FastAPI, Response
from fastapi.responses import Response
import uvicorn

app = FastAPI()


@app.get('/test/')
def get_test():
    print(123)
    return Response('hello')


if __name__ == '__main__':
    uvicorn.run(app, port=9999)
