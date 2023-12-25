import uvicorn
from common.router import register_router

from config.create_app import app

register_router(app)

if __name__ == "__main__":
    uvicorn.run(app=app, host="0.0.0.0", port=18990)
