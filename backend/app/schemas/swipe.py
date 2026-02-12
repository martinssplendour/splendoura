from pydantic import BaseModel
from app.models.swipe_history import SwipeAction


class SwipeCreate(BaseModel):
    action: SwipeAction
