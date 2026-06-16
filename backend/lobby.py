import asyncio
import random
import string
from typing import Optional
from models import RoomStatus
from game import empty_board, Board

ROOM_TIMEOUT_SOLO = 60   # seconds alone → auto AI
ROOM_TIMEOUT_DUO  = 30   # seconds with 2 players → auto start
MAX_PLAYERS = 3


class Room:
    def __init__(self, code: str, creator: str, ai_mode: bool = False):
        self.code = code
        self.creator = creator
        self.opponent: Optional[str] = None
        self.third_player: Optional[str] = None
        self.ai_mode = ai_mode
        self.status = RoomStatus.waiting
        self.board: Board = empty_board()
        self.current_turn: str = "red"
        self.red_player: Optional[str] = None
        self.yellow_player: Optional[str] = None
        self.blue_player: Optional[str] = None
        self.scores: dict[str, int] = {}
        self._solo_task: Optional[asyncio.Task] = None
        self._duo_task:  Optional[asyncio.Task] = None

    @property
    def player_count(self) -> int:
        return sum(1 for p in [self.red_player, self.yellow_player, self.blue_player] if p)

    # ── Timeout management ────────────────────────────────────────────────────

    def start_solo_timeout(self, rooms: dict) -> None:
        self._solo_task = asyncio.create_task(self._auto_ai(rooms))

    def start_duo_timeout(self, rooms: dict) -> None:
        self._duo_task = asyncio.create_task(self._auto_start_two(rooms))

    def cancel_solo_timeout(self) -> None:
        if self._solo_task and not self._solo_task.done():
            self._solo_task.cancel()

    def cancel_duo_timeout(self) -> None:
        if self._duo_task and not self._duo_task.done():
            self._duo_task.cancel()

    async def _auto_ai(self, rooms: dict) -> None:
        """60 s alone → enable AI as yellow and start."""
        await asyncio.sleep(ROOM_TIMEOUT_SOLO)
        if self.status != RoomStatus.waiting or self.player_count != 1 or self.code not in rooms:
            return
        self.ai_mode = True
        self.status = RoomStatus.playing
        self.opponent = "AI"
        self.yellow_player = "AI"
        self.scores["AI"] = 0
        # Notify any open WebSocket clients (lazy import avoids circular dependency)
        try:
            from websocket_manager import notify_game_started
            await notify_game_started(self.code)
        except Exception:
            pass

    async def _auto_start_two(self, rooms: dict) -> None:
        """30 s with 2 players → start without waiting for 3rd."""
        await asyncio.sleep(ROOM_TIMEOUT_DUO)
        if self.status != RoomStatus.waiting or self.player_count != 2 or self.code not in rooms:
            return
        self.status = RoomStatus.playing
        try:
            from websocket_manager import notify_game_started
            await notify_game_started(self.code)
        except Exception:
            pass

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "status": self.status.value,
            "creator": self.creator,
            "opponent": self.opponent,
            "third_player": self.third_player,
            "ai_mode": self.ai_mode,
            "player_count": self.player_count,
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
        room.start_solo_timeout(_rooms)
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
    if username in (room.red_player, room.yellow_player, room.blue_player):
        raise HTTPException(status_code=400, detail="You are already in this room")
    if room.player_count >= MAX_PLAYERS:
        raise HTTPException(status_code=400, detail="Room is full")

    if room.yellow_player is None:
        # Second player → cancel solo timer, start duo timer
        room.cancel_solo_timeout()
        room.opponent = username
        room.yellow_player = username
        room.scores[username] = 0
        room.start_duo_timeout(_rooms)
    else:
        # Third player → cancel duo timer, start immediately
        room.cancel_duo_timeout()
        room.third_player = username
        room.blue_player = username
        room.scores[username] = 0
        room.status = RoomStatus.playing

    return room


def start_now(code: str, username: str) -> Room:
    """Creator manually starts the game when ≥ 2 players are waiting."""
    from fastapi import HTTPException

    room = _rooms.get(code)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.creator != username:
        raise HTTPException(status_code=403, detail="Only the room creator can start the game")
    if room.status != RoomStatus.waiting:
        raise HTTPException(status_code=400, detail="Room already started")
    if room.player_count < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start")
    room.cancel_duo_timeout()
    room.status = RoomStatus.playing
    return room


def enable_ai_mode(code: str, username: str) -> Room:
    """
    1 human → AI as yellow (classic).
    2 humans → AI as blue (3rd slot).
    """
    from fastapi import HTTPException

    room = _rooms.get(code)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.creator != username:
        raise HTTPException(status_code=403, detail="Only the room creator can enable AI mode")
    if room.status != RoomStatus.waiting:
        raise HTTPException(status_code=400, detail="Room already started")

    room.cancel_solo_timeout()
    room.cancel_duo_timeout()
    room.ai_mode = True
    room.status = RoomStatus.playing

    if room.player_count == 1:
        room.opponent = "AI"
        room.yellow_player = "AI"
        room.scores["AI"] = 0
    else:
        # 2 humans already present → AI fills blue slot
        room.third_player = "AI"
        room.blue_player = "AI"
        room.scores["AI"] = 0

    return room


def delete_room(code: str) -> None:
    _rooms.pop(code, None)


def get_all_rooms() -> dict[str, Room]:
    return _rooms
