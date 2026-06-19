import json
import math
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect

from .game_loop import scatter_food_from_corpse, start_loop
from .models import GameRoom, Snake, VIEW_RADIUS
from .room_manager import remove_player, resolve_room_for_connect, spawn_snake

_room_connections: dict[str, dict[str, WebSocket]] = {}
# room_id (uppercase) -> { username -> WebSocket }


async def _send(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass


def has_connections(room_id: str) -> bool:
    return bool(_room_connections.get(room_id.upper()))


def _within_radius(point: list[float], cx: float, cy: float) -> bool:
    dx = point[0] - cx
    dy = point[1] - cy
    return dx * dx + dy * dy <= VIEW_RADIUS * VIEW_RADIUS


# ── Broadcast (called once per server tick from game_loop) ───────────────────

async def broadcast_world_state(room: GameRoom) -> None:
    connections = _room_connections.get(room.room_id)
    if not connections:
        return

    alive_snakes = [s for s in room.snakes.values() if s.alive]
    food_items = list(room.food.values())
    leaderboard = room.leaderboard()

    for username, ws in list(connections.items()):
        viewer = room.snakes.get(username)
        if not viewer or not viewer.alive:
            continue
        vx, vy = viewer.head

        visible_snakes = [
            s.to_state()
            for s in alive_snakes
            if s.id == viewer.id or _within_radius(s.head, vx, vy)
        ]
        visible_food = [
            f.to_state() for f in food_items if _within_radius([f.x, f.y], vx, vy)
        ]

        await _send(ws, {
            "type": "world_state",
            "tick": room.tick,
            "your_snake_id": viewer.id,
            "snakes": visible_snakes,
            "food": visible_food,
            "leaderboard": leaderboard,
            "map_size": room.map_size,
        })


async def send_death(room: GameRoom, snake: Snake, reason: str, killer: Optional[str]) -> None:
    ws = _room_connections.get(room.room_id, {}).get(snake.username)
    if not ws:
        return
    if reason == "wall":
        killed_by = "wall"
    elif reason == "self":
        killed_by = "self"
    elif reason == "disconnect":
        return
    else:
        killed_by = killer or "unknown"

    await _send(ws, {
        "type": "death",
        "final_length": round(snake.length),
        "killed_by": killed_by,
    })


# ── Connect / main loop ───────────────────────────────────────────────────────

async def handle_connect(websocket: WebSocket, room_id: str, username: str) -> None:
    room = resolve_room_for_connect(room_id)
    if room is None:
        await websocket.close(code=4004, reason="Room not found")
        return

    rid = room.room_id
    connections = _room_connections.setdefault(rid, {})

    old_ws = connections.get(username)
    if old_ws is not None and old_ws is not websocket:
        try:
            await old_ws.close(code=4009, reason="Replaced by new connection")
        except Exception:
            pass

    connections[username] = websocket

    snake = spawn_snake(room, username)
    start_loop(room)

    await _send(websocket, {
        "type": "joined",
        "your_snake_id": snake.id,
        "map_size": room.map_size,
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type")
            if msg_type == "direction":
                _handle_direction(room, username, msg)
            elif msg_type == "boost":
                _handle_boost(room, username, msg)
            elif msg_type == "respawn":
                await _handle_respawn(websocket, room, username)
            else:
                await _send(websocket, {"type": "error", "message": "Unknown message type"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if _room_connections.get(rid, {}).get(username) is websocket:
            _room_connections.get(rid, {}).pop(username, None)

        snake = room.snakes.get(username)
        if snake and snake.alive:
            snake.kill("disconnect")
            scatter_food_from_corpse(room, snake)
        remove_player(room, username)


def _handle_direction(room: GameRoom, username: str, msg: dict) -> None:
    snake = room.snakes.get(username)
    if not snake or not snake.alive:
        return

    angle = msg.get("angle")
    if angle is None:
        dx, dy = msg.get("dx"), msg.get("dy")
        if dx is None or dy is None or (dx == 0 and dy == 0):
            return
        angle = math.degrees(math.atan2(dy, dx))

    try:
        snake.set_target_direction(float(angle))
    except (TypeError, ValueError):
        pass


def _handle_boost(room: GameRoom, username: str, msg: dict) -> None:
    snake = room.snakes.get(username)
    if not snake or not snake.alive:
        return
    snake.set_boosting(bool(msg.get("active", False)))


async def _handle_respawn(websocket: WebSocket, room: GameRoom, username: str) -> None:
    snake = spawn_snake(room, username)
    start_loop(room)
    await _send(websocket, {
        "type": "joined",
        "your_snake_id": snake.id,
        "map_size": room.map_size,
    })
