import math
import time
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, PrivateAttr

# ── Tunables ──────────────────────────────────────────────────────────────────

MAP_SIZE = 3000.0
TICK_RATE = 20                      # server ticks per second
TICK_INTERVAL = 1.0 / TICK_RATE     # seconds per tick

INITIAL_LENGTH = 150.0
MIN_LENGTH_TO_BOOST = 60.0
BASE_SPEED = 140.0                  # units / second
BOOST_MULTIPLIER = 1.8
BOOST_DRAIN_PER_SECOND = 18.0
MAX_TURN_DEG_PER_SECOND = 220.0     # max angular velocity

COLLISION_RADIUS = 9.0              # half snake thickness, used for head/body hits
SELF_COLLISION_SKIP_POINTS = 12     # ignore the neck closest to the head (own body)

SPAWN_MARGIN = 250.0

FOOD_MIN_VALUE = 1
FOOD_MAX_VALUE = 3
FOOD_DENSITY_PER_UNIT_AREA = 1.0 / 30000.0   # target food items per square unit
FOOD_VALUE_LENGTH_GAIN = 14.0                # length gained per unit of food value

VIEW_RADIUS = 1400.0                # viewport culling radius (network optimization)
NETWORK_SEGMENT_STRIDE = 3          # only send every Nth body point to clients


def _dist(a: list[float], b: list[float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _turn_toward(current: float, target: float, max_delta: float) -> float:
    diff = (target - current + 180.0) % 360.0 - 180.0
    if diff > max_delta:
        diff = max_delta
    elif diff < -max_delta:
        diff = -max_delta
    return (current + diff) % 360.0


class Food(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    x: float
    y: float
    value: int = FOOD_MIN_VALUE

    def to_state(self) -> dict:
        return {"id": self.id, "x": round(self.x), "y": round(self.y), "value": self.value}


class Snake(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str
    username: str
    color: str
    segments: list[list[float]] = Field(default_factory=list)
    direction: float = 0.0
    target_direction: float = 0.0
    length: float = INITIAL_LENGTH
    alive: bool = True
    boosting: bool = False
    kills: int = 0
    joined_at: float = Field(default_factory=time.time)
    death_reason: Optional[str] = None
    killed_by: Optional[str] = None

    _segments_dirty_budget: float = PrivateAttr(default=0.0)

    @property
    def head(self) -> list[float]:
        if self.segments:
            return self.segments[0]
        return [MAP_SIZE / 2.0, MAP_SIZE / 2.0]

    def spawn(self, x: float, y: float, direction: float) -> None:
        self.segments = [[x, y]]
        self.direction = direction
        self.target_direction = direction
        self.length = INITIAL_LENGTH
        self.alive = True
        self.boosting = False
        self.death_reason = None
        self.killed_by = None

    def set_target_direction(self, degrees: float) -> None:
        self.target_direction = degrees % 360.0

    def set_boosting(self, active: bool) -> None:
        self.boosting = bool(active) and self.length > MIN_LENGTH_TO_BOOST

    def is_boost_active(self) -> bool:
        return self.boosting and self.length > MIN_LENGTH_TO_BOOST

    def current_speed(self) -> float:
        return BASE_SPEED * BOOST_MULTIPLIER if self.is_boost_active() else BASE_SPEED

    def advance(self, dt: float) -> None:
        if not self.alive:
            return

        max_delta = MAX_TURN_DEG_PER_SECOND * dt
        self.direction = _turn_toward(self.direction, self.target_direction, max_delta)

        speed = self.current_speed()
        rad = math.radians(self.direction)
        hx, hy = self.head
        nx = hx + math.cos(rad) * speed * dt
        ny = hy + math.sin(rad) * speed * dt

        self.segments.insert(0, [nx, ny])

        if self.is_boost_active():
            self.length = max(MIN_LENGTH_TO_BOOST, self.length - BOOST_DRAIN_PER_SECOND * dt)
        if self.length <= MIN_LENGTH_TO_BOOST:
            self.boosting = False

        self._trim_to_length()

    def _trim_to_length(self) -> None:
        pts = self.segments
        if len(pts) <= 1:
            return
        total = 0.0
        cutoff = self.length
        trimmed = [pts[0]]
        for i in range(1, len(pts)):
            d = _dist(pts[i - 1], pts[i])
            total += d
            trimmed.append(pts[i])
            if total >= cutoff:
                break
        self.segments = trimmed

    def grow(self, amount: float) -> None:
        self.length += amount

    def kill(self, reason: str, killed_by: Optional[str] = None) -> None:
        self.alive = False
        self.death_reason = reason
        self.killed_by = killed_by

    def out_of_bounds(self, map_size: float) -> bool:
        x, y = self.head
        return x < 0 or y < 0 or x > map_size or y > map_size

    def hits_point(self, point: list[float], extra_radius: float = 0.0) -> bool:
        return _dist(self.head, point) <= (COLLISION_RADIUS * 2.0 + extra_radius)

    def body_points_for_collision(self, skip_own_neck: bool = False) -> list[list[float]]:
        if not skip_own_neck:
            return self.segments
        return self.segments[SELF_COLLISION_SKIP_POINTS:]

    def to_state(self, stride: int = NETWORK_SEGMENT_STRIDE) -> dict:
        pts = self.segments[::stride] if stride > 1 else self.segments
        if self.segments and (not pts or pts[0] != self.segments[0]):
            pts = [self.segments[0], *pts]
        return {
            "id": self.id,
            "username": self.username,
            "color": self.color,
            "alive": self.alive,
            "length": round(self.length),
            "boosting": self.boosting,
            "segments": [[round(x), round(y)] for x, y in pts],
        }


class GameRoom(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    room_id: str
    is_public: bool
    creator: Optional[str] = None
    map_size: float = MAP_SIZE
    snakes: dict[str, Snake] = Field(default_factory=dict)
    food: dict[str, Food] = Field(default_factory=dict)
    tick: int = 0
    created_at: float = Field(default_factory=time.time)
    last_active_at: float = Field(default_factory=time.time)

    @property
    def player_count(self) -> int:
        return sum(1 for s in self.snakes.values() if s.alive)

    @property
    def target_food_count(self) -> int:
        return int((self.map_size * self.map_size) * FOOD_DENSITY_PER_UNIT_AREA)

    def leaderboard(self, limit: int = 10) -> list[dict]:
        alive = [s for s in self.snakes.values() if s.alive]
        alive.sort(key=lambda s: s.length, reverse=True)
        return [
            {"username": s.username, "length": round(s.length), "color": s.color}
            for s in alive[:limit]
        ]

    def to_summary(self) -> dict:
        return {
            "room_id": self.room_id,
            "is_public": self.is_public,
            "creator": self.creator,
            "player_count": self.player_count,
            "map_size": self.map_size,
        }
