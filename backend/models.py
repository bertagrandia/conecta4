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


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


class UserInDB(BaseModel):
    username: str
    hashed_password: str


class RoomCreate(BaseModel):
    ai_mode: bool = False


class RoomInfo(BaseModel):
    code: str
    status: RoomStatus
    creator: str
    opponent: Optional[str] = None
    ai_mode: bool = False


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
