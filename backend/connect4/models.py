from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RoomStatus(str, Enum):
    waiting = "waiting"
    playing = "playing"
    finished = "finished"


class PlayerColor(str, Enum):
    red = "red"
    yellow = "yellow"
    blue = "blue"


class GuestLogin(BaseModel):
    username: str = Field(..., min_length=1, max_length=20)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RoomCreate(BaseModel):
    ai_mode: bool = False


class RoomInfo(BaseModel):
    code: str
    status: RoomStatus
    creator: str
    opponent: Optional[str] = None
    third_player: Optional[str] = None
    ai_mode: bool = False
    player_count: int = 1


class MoveMessage(BaseModel):
    type: str
    column: int


class RematchMessage(BaseModel):
    type: str


class SurrenderMessage(BaseModel):
    type: str


class WSMessage(BaseModel):
    type: str
    column: Optional[int] = None
