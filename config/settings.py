import os

from environ import Env

env = Env()

# Set the project base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Take environment variables from .env file
Env.read_env(os.path.join(BASE_DIR, ".env"))

DEBUG = env("DEBUG", default=True)

PG_HOST = env('PG_HOST')
PG_PORT = env('PG_PORT')
PG_USER = env('PG_USER')
PG_PASS = env('PG_PASS')
PG_DB = env('PG_DB')
DB_URL = f"postgres://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"

# REDIS_HOST = env('REDIS_HOST')
# REDIS_PORT = env('REDIS_PORT')
# REDIS_USER = env('REDIS_USER')
# REDIS_PASS = env('REDIS_PASS')
# REDIS_DB = env('REDIS_DB')
# REDIS_URL = f"redis://{REDIS_USER}:{REDIS_PASS}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}?encoding=utf-8"

TORTOISE_ORM = {
    "connections": {"default": DB_URL},
    "apps": {
        "models": {
            "models": [
                'aerich.models',
                'common.models',
                'modules.music.models',
            ],
            "default_connection": "default",
        },
    },
}

# to get a string like this run:
# openssl rand -hex 32
SECRET_KEY = env('SECRET_KEY')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

HTTP_ADDR = 'http://localhost'
HTTP_PORT = 9100
HTTP_SITE = f'{HTTP_ADDR}:{HTTP_PORT}'
DEFAULT_AVATAR = f'/static/avatar/default.jpg'


# music
NETEASE_TOPLIST = 'https://music.163.com/discover/toplist'
