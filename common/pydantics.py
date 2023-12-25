from fastapi import Response, status


class Reseponse(Response):
    code: int = status.HTTP_200_OK
    msg: str = "success"
    data: dict | list | str = None
