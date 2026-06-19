import random
import string
import time
from typing import Optional

from fastapi import HTTPException

from .game_loop import find_spawn_point, stop_loop
from .models import GameRoom, Snake

PUBLIC_ROOM_ID = "PUBLIC"
PRIVATE_ROOM_TTL_EMPTY = 120  # seconds an empty private room is kept before cleanup

SNAKE_COLORS = [
    "#39FF88", "#FF5C5C", "#5CC9FF", "#FFD15C", "#C45CFF",
    "#5CFFE0", "#FF8A5C", "#9CFF5C", "#5C7BFF", "#FF5CC4",
]

_rooms: dict[str, GameRoom] = {}


def _generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        if code not in _rooms:
            return code


def _purge_stale_private_rooms() -> None:
    now = time.time()
    stale = [
        room_id
        for room_id, room in _rooms.items()
        if not room.is_public
        and room.player_count == 0
        and (now - room.last_active_at) > PRIVATE_ROOM_TTL_EMPTY
    ]
    for room_id in stale:
        stop_loop(room_id)
        _rooms.pop(room_id, None)


def _ensure_public_room() -> GameRoom:
    room = _rooms.get(PUBLIC_ROOM_ID)
    if room is None:
        room = GameRoom(room_id=PUBLIC_ROOM_ID, is_public=True, creator=None)
        _rooms[PUBLIC_ROOM_ID] = room
    return room


def create_private_room(creator: str) -> GameRoom:
    _purge_stale_private_rooms()
    code = _generate_code()
    room = GameRoom(room_id=code, is_public=False, creator=creator)
    _rooms[code] = room
    return room


def get_room(room_id: str) -> Optional[GameRoom]:
    return _rooms.get(room_id.upper())


def resolve_room_for_connect(room_id: str) -> Optional[GameRoom]:
    """Used by the websocket handler: the public room is created lazily,
    private rooms must already exist (created beforehand via REST)."""
    rid = room_id.upper()
    if rid == PUBLIC_ROOM_ID:
        return _ensure_public_room()
    return _rooms.get(rid)


def get_room_or_404(room_id: str) -> GameRoom:
    room = get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


def list_public_rooms() -> list[dict]:
    _ensure_public_room()
    rooms = [room for room in _rooms.values() if room.is_public]
    rooms.sort(key=lambda r: r.player_count, reverse=True)
    return [room.to_summary() for room in rooms]


def _pick_color(room: GameRoom) -> str:
    used = {s.color for s in room.snakes.values()}
    available = [c for c in SNAKE_COLORS if c not in used]
    return random.choice(available or SNAKE_COLORS)


def spawn_snake(room: GameRoom, username: str) -> Snake:
    room.last_active_at = time.time()
    x, y, angle = find_spawn_point(room)
    existing = room.snakes.get(username)
    if existing:
        existing.spawn(x, y, angle)
        return existing

    snake = Snake(id=username, username=username, color=_pick_color(room))
    snake.spawn(x, y, angle)
    room.snakes[username] = snake
    return snake


def remove_player(room: GameRoom, username: str) -> None:
    room.snakes.pop(username, None)
    room.last_active_at = time.time()
