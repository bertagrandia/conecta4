export type Board = number[][];
export type PlayerColor = 'red' | 'yellow' | 'blue';
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
  third_player: string | null;
  ai_mode: boolean;
  player_count: number;
}

export interface GameState {
  type: 'game_state';
  board: Board;
  current_turn: PlayerColor;
  status: GameStatus;
  red_player: string | null;
  yellow_player: string | null;
  blue_player: string | null;
  scores: Record<string, number>;
  players: PlayerColor[];
  disconnected_colors: PlayerColor[];
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
  color: PlayerColor | null;
  continues: boolean;
  current_turn?: PlayerColor;
  disconnected_colors?: PlayerColor[];
  reason?: string;
}

export interface WSError {
  type: 'error';
  message: string;
}

export interface AIFallback {
  type: 'ai_fallback';
  error: string;
}

export type WSMessage = GameState | MoveResult | GameOver | PlayerDisconnected | WSError | AIFallback;

export interface LocalGameState {
  board: Board;
  currentTurn: PlayerColor;
  status: GameStatus;
  redPlayer: string | null;
  yellowPlayer: string | null;
  bluePlayer: string | null;
  scores: Record<string, number>;
  players: PlayerColor[];
  disconnectedColors: PlayerColor[];
  winner: PlayerColor | 'draw' | null;
  winningCells: [number, number][];
  disconnectedPlayer: string | null;
  myColor: PlayerColor | null;
  roomCode: string | null;
  aiMode: boolean;
  aiError: string | null;
}
