import asyncio
import random
import string
from typing import Optional
from models import RoomStatus
from game import empty_board, Board

ROOM_TIMEOUT_SECONDS = 60


class Room:
    def __init__(self, code: str, creator: str, ai_mode: bool = False):
        self.code = code
        self.creator = creator
        self.opponent: Optional[str] = None
        self.ai_mode = ai_mode
        self.status = RoomStatus.waiting
        self.board: Board = empty_board()
        self.current_turn: str = "red"
        self.red_player: Optional[str] = None
        self.yellow_player: Optional[str] = None
        self.scores: dict[str, int] = {}
        self._timeout_task: Optional[asyncio.Task] = None

    def start_timeout(self, rooms: dict) -> None:
        self._timeout_task = asyncio.create_task(self._auto_close(rooms))

    async def _auto_close(self, rooms: dict) -> None:
        await asyncio.sleep(ROOM_TIMEOUT_SECONDS)
        if self.status == RoomStatus.waiting and self.code in rooms:
            del rooms[self.code]

    def cancel_timeout(self) -> None:
        if self._timeout_task and not self._timeout_task.done():
            self._timeout_task.cancel()

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "status": self.status.value,
            "creator": self.creator,
            "opponent": self.opponent,
            "ai_mode": self.ai_mode,
        }


_rooms: dict[str, Room] = {}


def _generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        if code not in _rooms:
            return code


def create_room(creator: str, ai_mode: bool = False) -> Room:
    code = _generate_code()
    room = Room(code=code, creator=creator, ai_mode=ai_mode)
    room.red_player = creator
    room.scores[creator] = 0
    _rooms[code] = room
    if not ai_mode:
        room.start_timeout(_rooms)
    else:
        room.status = RoomStatus.playing
        room.opponent = "AI"
        room.yellow_player = "AI"
        room.scores["AI"] = 0
    return room


def get_room(code: str) -> Optional[Room]:
    return _rooms.get(code)


def join_room(code: str, username: str) -> Room:
    from fastapi import HTTPException

    room = _rooms.get(code)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.status != RoomStatus.waiting:
        raise HTTPException(status_code=400, detail="Room is full or game already started")
    if room.creator == username:
        raise HTTPException(status_code=400, detail="You cannot join your own room")

    room.cancel_timeout()
    room.opponent = username
    room.yellow_player = username
    room.scores[username] = 0
    room.status = RoomStatus.playing
    return room


def enable_ai_mode(code: str, username: str) -> Room:
    from fastapi import HTTPException

    room = _rooms.get(code)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.creator != username:
        raise HTTPException(status_code=403, detail="Only the room creator can enable AI mode")
    if room.status != RoomStatus.waiting:
        raise HTTPException(status_code=400, detail="Room already started")
    room.cancel_timeout()
    room.ai_mode = True
    room.status = RoomStatus.playing
    room.opponent = "AI"
    room.yellow_player = "AI"
    room.scores["AI"] = 0
    return room


def delete_room(code: str) -> None:
    _rooms.pop(code, None)


def get_all_rooms() -> dict[str, Room]:
    return _rooms
