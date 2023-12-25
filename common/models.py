from tortoise import fields, models


class BaseModel(models.Model):
    """
    Base model for all models
    """

    id = fields.IntField(pk=True)
    create_time = fields.DatetimeField(auto_now_add=True)
    update_time = fields.DatetimeField(auto_now=True)

    class Meta:
        abstract = True
