import asyncio
import random
import time
from typing import Optional

from .models import (
    COLLISION_RADIUS,
    FOOD_MAX_VALUE,
    FOOD_MIN_VALUE,
    FOOD_VALUE_LENGTH_GAIN,
    Food,
    GameRoom,
    SPAWN_MARGIN,
    Snake,
    TICK_INTERVAL,
    _dist,
)

_room_loops: dict[str, asyncio.Task] = {}


def is_room_loop_running(room_id: str) -> bool:
    task = _room_loops.get(room_id)
    return task is not None and not task.done()


def start_loop(room: GameRoom) -> None:
    """Launch the fixed-tick simulation loop for a room as a background task.

    Uses asyncio.create_task so the loop runs concurrently without blocking
    the FastAPI event loop; the coroutine yields via asyncio.sleep every tick.
    """
    if is_room_loop_running(room.room_id):
        return
    task = asyncio.create_task(_run_room_loop(room))
    _room_loops[room.room_id] = task


def stop_loop(room_id: str) -> None:
    task = _room_loops.pop(room_id, None)
    if task and not task.done():
        task.cancel()


def find_spawn_point(room: GameRoom) -> tuple[float, float, float]:
    for _ in range(20):
        x = random.uniform(SPAWN_MARGIN, room.map_size - SPAWN_MARGIN)
        y = random.uniform(SPAWN_MARGIN, room.map_size - SPAWN_MARGIN)
        safe = all(
            _dist([x, y], other.head) >= 250.0
            for other in room.snakes.values()
            if other.alive
        )
        if safe:
            return x, y, random.uniform(0, 360)
    return room.map_size / 2.0, room.map_size / 2.0, random.uniform(0, 360)


async def _run_room_loop(room: GameRoom) -> None:
    # Lazy import: websocket_handler imports room_manager which imports this
    # module, so importing it at module scope here would create a cycle.
    from .websocket_handler import broadcast_world_state, has_connections, send_death

    try:
        while True:
            tick_start = time.monotonic()

            _spawn_food_if_needed(room)
            _advance_snakes(room)
            deaths = _resolve_collisions(room)

            room.tick += 1

            for snake_id, reason, killer in deaths:
                snake = room.snakes.get(snake_id)
                if snake:
                    await send_death(room, snake, reason, killer)

            await broadcast_world_state(room)

            if room.player_count == 0 and not has_connections(room.room_id):
                break

            elapsed = time.monotonic() - tick_start
            await asyncio.sleep(max(0.0, TICK_INTERVAL - elapsed))
    except asyncio.CancelledError:
        pass
    finally:
        _room_loops.pop(room.room_id, None)


def _advance_snakes(room: GameRoom) -> None:
    for snake in room.snakes.values():
        if snake.alive:
            snake.advance(TICK_INTERVAL)


def _resolve_collisions(room: GameRoom) -> list[tuple[str, str, Optional[str]]]:
    alive_snakes = [s for s in room.snakes.values() if s.alive]

    _consume_food(room, alive_snakes)

    deaths: list[tuple[str, str, Optional[str]]] = []

    for snake in alive_snakes:
        if snake.out_of_bounds(room.map_size):
            snake.kill("wall")
            deaths.append((snake.id, "wall", None))

    alive_snakes = [s for s in alive_snakes if s.alive]

    for snake in alive_snakes:
        killer_username = _find_body_collision(room, snake)
        if killer_username is False:
            continue
        reason = "self" if killer_username is None else "killed"
        snake.kill(reason, killer_username)
        deaths.append((snake.id, reason, killer_username))
        if killer_username:
            killer = next((s for s in room.snakes.values() if s.username == killer_username), None)
            if killer:
                killer.kills += 1

    for snake_id, _reason, _killer in deaths:
        snake = room.snakes.get(snake_id)
        if snake:
            scatter_food_from_corpse(room, snake)

    return deaths


def _consume_food(room: GameRoom, alive_snakes: list[Snake]) -> None:
    for snake in alive_snakes:
        eaten_ids = [
            food.id
            for food in room.food.values()
            if _dist(snake.head, [food.x, food.y]) <= COLLISION_RADIUS + 6.0
        ]
        for fid in eaten_ids:
            food = room.food.pop(fid, None)
            if food:
                snake.grow(food.value * FOOD_VALUE_LENGTH_GAIN)


def _find_body_collision(room: GameRoom, snake: Snake):
    """Returns the killer's username, None for self-collision, or False if no hit."""
    head = snake.head
    for other in room.snakes.values():
        if not other.alive:
            continue
        is_self = other.id == snake.id
        points = other.body_points_for_collision(skip_own_neck=is_self)
        for point in points:
            if _dist(head, point) <= COLLISION_RADIUS * 2.0:
                return None if is_self else other.username
    return False


def scatter_food_from_corpse(room: GameRoom, snake: Snake) -> None:
    points = snake.segments[::4] or snake.segments[:1]
    for x, y in points:
        value = random.randint(FOOD_MIN_VALUE, FOOD_MAX_VALUE)
        food = Food(x=x, y=y, value=value)
        room.food[food.id] = food


def _spawn_food_if_needed(room: GameRoom) -> None:
    deficit = room.target_food_count - len(room.food)
    if deficit <= 0:
        return
    for _ in range(min(deficit, 8)):
        x = random.uniform(SPAWN_MARGIN, room.map_size - SPAWN_MARGIN)
        y = random.uniform(SPAWN_MARGIN, room.map_size - SPAWN_MARGIN)
        value = random.choices([FOOD_MIN_VALUE, 2, FOOD_MAX_VALUE], weights=[70, 25, 5])[0]
        food = Food(x=x, y=y, value=value)
        room.food[food.id] = food
