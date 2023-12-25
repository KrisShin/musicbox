from fastapi import FastAPI
from tortoise import Tortoise
from modules.music.apis import router as music_router


def register_router(app: FastAPI):
    Tortoise.init_models(
        ['common.models', 'modules.music.models', 'modules.music.models'], 'models'
    )

    app.include_router(
        music_router,
        tags=['music'],
        responses={404: {'description': 'Not Found'}},
        prefix="/api/music",
    )
