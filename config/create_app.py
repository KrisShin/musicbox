from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import DEBUG


def create_app():
    if DEBUG:
        app = FastAPI()
    else:
        app = FastAPI(docs_url=None)

    origins = [
        "http://localhost",
        "http://localhost:3000",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    return app


app = create_app()
