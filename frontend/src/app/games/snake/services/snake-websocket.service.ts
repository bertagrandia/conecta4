import { Injectable, OnDestroy, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { SnakeArenaState, SnakeServerMessage, WorldSnapshot } from '../models';

const INITIAL_STATE = (): SnakeArenaState => ({
  connected: false,
  mapSize: 3000,
  yourSnakeId: null,
  previousSnapshot: null,
  latestSnapshot: null,
  death: null,
  error: null,
});

const DIRECTION_SEND_INTERVAL_MS = 80;

@Injectable({ providedIn: 'root' })
export class SnakeWebsocketService implements OnDestroy {
  readonly state = signal<SnakeArenaState>(INITIAL_STATE());

  private ws: WebSocket | null = null;
  private roomId = '';
  private token = '';
  private retries = 0;
  private readonly maxRetries = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private directionTimer: ReturnType<typeof setInterval> | null = null;
  private manualClose = false;

  private intendedAngle = 0;
  private lastSentAngle: number | null = null;

  connect(roomId: string, token: string): void {
    this.roomId = roomId;
    this.token = token;
    this.retries = 0;
    this.manualClose = false;
    this.lastSentAngle = null;
    this.state.set(INITIAL_STATE());
    this._open();
    this.directionTimer = setInterval(() => this._flushDirection(), DIRECTION_SEND_INTERVAL_MS);
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.directionTimer) clearInterval(this.directionTimer);
    this.directionTimer = null;
    this.ws?.close();
    this.ws = null;
    this.state.set(INITIAL_STATE());
  }

  setDirection(angleDeg: number): void {
    this.intendedAngle = ((angleDeg % 360) + 360) % 360;
  }

  setBoost(active: boolean): void {
    this._send({ type: 'boost', active });
  }

  respawn(): void {
    this.state.update((s) => ({ ...s, death: null, previousSnapshot: null, latestSnapshot: null }));
    this._send({ type: 'respawn' });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private _open(): void {
    const url = `${environment.wsUrl}/snake/ws/${this.roomId}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.retries = 0;
      this.state.update((s) => ({ ...s, connected: true }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: SnakeServerMessage = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch {
        /* ignore malformed frame */
      }
    };

    this.ws.onclose = () => {
      this.state.update((s) => ({ ...s, connected: false }));
      if (this.manualClose) return;
      if (this.retries < this.maxRetries) {
        this.retries++;
        this.reconnectTimeout = setTimeout(() => this._open(), 1500 * this.retries);
      }
    };

    this.ws.onerror = () => {};
  }

  private _send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private _flushDirection(): void {
    if (
      this.lastSentAngle === null ||
      Math.abs(this._angleDelta(this.lastSentAngle, this.intendedAngle)) > 0.5
    ) {
      this._send({ type: 'direction', angle: this.intendedAngle });
      this.lastSentAngle = this.intendedAngle;
    }
  }

  private _angleDelta(a: number, b: number): number {
    let diff = ((b - a + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    return diff;
  }

  private _handleMessage(msg: SnakeServerMessage): void {
    if (msg.type === 'joined') {
      this.state.update((s) => ({
        ...s,
        yourSnakeId: msg.your_snake_id,
        mapSize: msg.map_size,
        death: null,
        previousSnapshot: null,
        latestSnapshot: null,
      }));
    } else if (msg.type === 'world_state') {
      const snapshot: WorldSnapshot = {
        receivedAt: performance.now(),
        tick: msg.tick,
        snakes: msg.snakes,
        food: msg.food,
        leaderboard: msg.leaderboard,
      };
      this.state.update((s) => ({
        ...s,
        mapSize: msg.map_size,
        yourSnakeId: msg.your_snake_id,
        previousSnapshot: s.latestSnapshot,
        latestSnapshot: snapshot,
      }));
    } else if (msg.type === 'death') {
      this.state.update((s) => ({ ...s, death: msg }));
    } else if (msg.type === 'error') {
      this.state.update((s) => ({ ...s, error: msg.message }));
    }
  }
}
