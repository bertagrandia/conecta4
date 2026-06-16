import { Injectable, OnDestroy, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  WSMessage,
  LocalGameState,
  Board,
  PlayerColor,
} from '../models';

const EMPTY_BOARD = (): Board => Array.from({ length: 6 }, () => Array(7).fill(0));

const INITIAL_STATE = (): LocalGameState => ({
  board: EMPTY_BOARD(),
  currentTurn: 'red',
  status: 'waiting',
  redPlayer: null,
  yellowPlayer: null,
  bluePlayer: null,
  scores: {},
  players: [],
  disconnectedColors: [],
  winner: null,
  winningCells: [],
  disconnectedPlayer: null,
  myColor: null,
  roomCode: null,
  aiMode: false,
  aiError: null,
});

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  readonly gameState = signal<LocalGameState>(INITIAL_STATE());

  private ws: WebSocket | null = null;
  private roomCode = '';
  private token = '';
  private username = '';
  private retries = 0;
  private maxRetries = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  connect(roomCode: string, token: string, username: string): void {
    this.roomCode = roomCode;
    this.token = token;
    this.username = username;
    this.retries = 0;
    this.manualClose = false;
    this._open();
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
    this.gameState.set(INITIAL_STATE());
  }

  sendMove(column: number): void {
    this._send({ type: 'move', column });
  }

  sendRematch(): void {
    this._send({ type: 'rematch' });
  }

  sendSurrender(): void {
    this._send({ type: 'surrender' });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private _open(): void {
    const url = `${environment.wsUrl}/ws/${this.roomCode}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.retries = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch {}
    };

    this.ws.onclose = () => {
      if (this.manualClose) return;
      if (this.retries < this.maxRetries) {
        this.retries++;
        this.reconnectTimeout = setTimeout(() => this._open(), 2000 * this.retries);
      }
    };

    this.ws.onerror = () => {};
  }

  private _send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private _handleMessage(msg: WSMessage): void {
    this.gameState.update((prev) => {
      const next = { ...prev };

      if (msg.type === 'game_state') {
        next.board = msg.board;
        next.currentTurn = msg.current_turn;
        next.status = msg.status;
        next.redPlayer = msg.red_player;
        next.yellowPlayer = msg.yellow_player;
        next.bluePlayer = msg.blue_player;
        next.scores = msg.scores;
        next.players = msg.players ?? [];
        next.disconnectedColors = msg.disconnected_colors ?? [];
        next.winner = null;
        next.winningCells = [];
        next.disconnectedPlayer = null;
        next.myColor = this._resolveColor(msg.red_player, msg.yellow_player, msg.blue_player);
      } else if (msg.type === 'move_result') {
        next.board = msg.board;
        next.currentTurn = msg.current_turn;
        next.scores = msg.scores;
      } else if (msg.type === 'game_over') {
        next.board = msg.board;
        next.status = 'finished';
        next.winner = msg.winner;
        next.winningCells = msg.winning_cells as [number, number][];
        next.scores = msg.scores;
      } else if (msg.type === 'player_disconnected') {
        next.disconnectedPlayer = msg.username;
        if (msg.continues) {
          // 3-player: game goes on, just skip this player's turns
          next.currentTurn = msg.current_turn ?? next.currentTurn;
          next.disconnectedColors = msg.disconnected_colors ?? next.disconnectedColors;
        } else {
          next.status = 'finished';
        }
      } else if (msg.type === 'ai_fallback') {
        next.aiError = msg.error;
      }

      return next;
    });
  }

  private _resolveColor(
    redPlayer: string | null,
    yellowPlayer: string | null,
    bluePlayer: string | null,
  ): PlayerColor | null {
    if (redPlayer === this.username)    return 'red';
    if (yellowPlayer === this.username) return 'yellow';
    if (bluePlayer === this.username)   return 'blue';
    return null;
  }
}
