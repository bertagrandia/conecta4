export interface SnakeRoomSummary {
  room_id: string;
  is_public: boolean;
  creator: string | null;
  player_count: number;
  map_size: number;
}

export interface SnakeState {
  id: string;
  username: string;
  color: string;
  alive: boolean;
  length: number;
  boosting: boolean;
  segments: [number, number][];
}

export interface FoodState {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface LeaderboardEntry {
  username: string;
  length: number;
  color: string;
}

export interface JoinedMessage {
  type: 'joined';
  your_snake_id: string;
  map_size: number;
}

export interface WorldStateMessage {
  type: 'world_state';
  tick: number;
  your_snake_id: string;
  snakes: SnakeState[];
  food: FoodState[];
  leaderboard: LeaderboardEntry[];
  map_size: number;
}

export type DeathCause = 'wall' | 'self' | string;

export interface DeathMessage {
  type: 'death';
  final_length: number;
  killed_by: DeathCause;
}

export interface SnakeErrorMessage {
  type: 'error';
  message: string;
}

export type SnakeServerMessage = JoinedMessage | WorldStateMessage | DeathMessage | SnakeErrorMessage;

export interface DirectionCommand {
  type: 'direction';
  angle: number;
}

export interface BoostCommand {
  type: 'boost';
  active: boolean;
}

export interface RespawnCommand {
  type: 'respawn';
}

export type SnakeClientCommand = DirectionCommand | BoostCommand | RespawnCommand;

export interface WorldSnapshot {
  receivedAt: number;
  tick: number;
  snakes: SnakeState[];
  food: FoodState[];
  leaderboard: LeaderboardEntry[];
}

export interface SnakeArenaState {
  connected: boolean;
  mapSize: number;
  yourSnakeId: string | null;
  previousSnapshot: WorldSnapshot | null;
  latestSnapshot: WorldSnapshot | null;
  death: DeathMessage | null;
  error: string | null;
}
