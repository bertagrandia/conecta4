export type Board = number[][];
export type PlayerColor = 'red' | 'yellow';
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Token {
  access_token: string;
  token_type: string;
}

export interface RoomInfo {
  code: string;
  status: GameStatus;
  creator: string;
  opponent: string | null;
  ai_mode: boolean;
}

export interface GameState {
  type: 'game_state';
  board: Board;
  current_turn: PlayerColor;
  status: GameStatus;
  red_player: string | null;
  yellow_player: string | null;
  scores: Record<string, number>;
}

export interface MoveResult {
  type: 'move_result';
  board: Board;
  column: number;
  row: number;
  player: PlayerColor;
  current_turn: PlayerColor;
  scores: Record<string, number>;
}

export interface GameOver {
  type: 'game_over';
  board: Board;
  winner: PlayerColor | 'draw';
  winning_cells: [number, number][];
  scores: Record<string, number>;
  reason?: string;
}

export interface PlayerDisconnected {
  type: 'player_disconnected';
  username: string;
}

export interface WSError {
  type: 'error';
  message: string;
}

export type WSMessage = GameState | MoveResult | GameOver | PlayerDisconnected | WSError;

export interface LocalGameState {
  board: Board;
  currentTurn: PlayerColor;
  status: GameStatus;
  redPlayer: string | null;
  yellowPlayer: string | null;
  scores: Record<string, number>;
  winner: PlayerColor | 'draw' | null;
  winningCells: [number, number][];
  disconnectedPlayer: string | null;
  myColor: PlayerColor | null;
  roomCode: string | null;
  aiMode: boolean;
}
