import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BoardComponent } from './board/board.component';
import { WebSocketService } from '../services/websocket.service';
import { AuthService } from '../services/auth.service';
import { PlayerColor } from '../models';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, BoardComponent],
  template: `
    <div class="game-bg">
      <header class="top-bar">
        <button class="back-btn" (click)="goLobby()">← Lobby</button>
        <span class="room-label">Sala <strong>{{ roomCode }}</strong></span>
        <button class="surrender-btn" (click)="surrender()" *ngIf="state().status === 'playing'">
          Rendirse
        </button>
      </header>

      <!-- STATUS BAR -->
      <div class="status-bar">
        <div class="player-tag" [class.active]="state().currentTurn === 'red' && state().status === 'playing'">
          <span class="dot red"></span>
          <span class="name">{{ state().redPlayer ?? 'Esperando...' }}</span>
          <span class="score">{{ state().scores[state().redPlayer ?? ''] ?? 0 }}</span>
        </div>

        <div class="turn-msg">
          <ng-container *ngIf="state().status === 'playing'">
            <ng-container *ngIf="isMyTurn(); else notMyTurn">
              ¡Tu turno!
            </ng-container>
            <ng-template #notMyTurn>
              Turno de {{ currentTurnName() }}
            </ng-template>
          </ng-container>
          <ng-container *ngIf="state().status === 'waiting'">
            Esperando oponente...
          </ng-container>
          <ng-container *ngIf="state().status === 'finished'">
            Partida terminada
          </ng-container>
        </div>

        <div class="player-tag" [class.active]="state().currentTurn === 'yellow' && state().status === 'playing'">
          <span class="dot yellow"></span>
          <span class="name">{{ state().yellowPlayer ?? 'Esperando...' }}</span>
          <span class="score">{{ state().scores[state().yellowPlayer ?? ''] ?? 0 }}</span>
        </div>
      </div>

      <!-- BOARD -->
      <div class="board-area">
        <app-board
          [board]="state().board"
          [myColor]="state().myColor"
          [canPlay]="isMyTurn() && state().status === 'playing'"
          [winningCells]="state().winningCells"
          [lastMove]="lastMove()"
          (columnClicked)="onColumnClick($event)"
        ></app-board>
      </div>

      <!-- GAME OVER OVERLAY -->
      <div class="overlay" *ngIf="state().status === 'finished'">
        <div class="overlay-card">
          <ng-container *ngIf="state().disconnectedPlayer">
            <div class="result-icon">📡</div>
            <h2 class="result-text">{{ state().disconnectedPlayer }} se desconectó</h2>
          </ng-container>

          <ng-container *ngIf="!state().disconnectedPlayer && state().winner">
            <ng-container *ngIf="state().winner === 'draw'">
              <div class="result-icon">🤝</div>
              <h2 class="result-text">¡Empate!</h2>
            </ng-container>
            <ng-container *ngIf="state().winner !== 'draw'">
              <div class="result-icon" [class.red-win]="state().winner === 'red'" [class.yellow-win]="state().winner === 'yellow'">
                <span class="big-disc" [class.red]="state().winner === 'red'" [class.yellow]="state().winner === 'yellow'"></span>
              </div>
              <h2 class="result-text">
                {{ winnerName() }} gana!
              </h2>
              <p class="result-sub" *ngIf="state().winner === state().myColor">¡Enhorabuena!</p>
            </ng-container>
          </ng-container>

          <div class="overlay-actions">
            <button class="btn primary" (click)="rematch()">Revancha</button>
            <button class="btn secondary" (click)="goLobby()">Volver al Lobby</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .game-bg {
      min-height: 100vh;
      background: #0D1B2A;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .top-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      background: #1B2A3B;
      border-bottom: 1px solid #2a3d52;
      box-sizing: border-box;
    }
    .back-btn {
      background: transparent;
      border: 1px solid #2a3d52;
      color: #8aa3bc;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: border-color 0.2s, color 0.2s;
    }
    .back-btn:hover { border-color: #4a9eff; color: #4a9eff; }
    .room-label { color: #8aa3bc; font-size: 0.9rem; }
    .room-label strong { color: #4a9eff; letter-spacing: 2px; }
    .surrender-btn {
      background: transparent;
      border: 1px solid #E63946;
      color: #E63946;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .surrender-btn:hover { background: rgba(230,57,70,0.1); }

    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 600px;
      padding: 1rem 1.5rem;
      box-sizing: border-box;
    }
    .player-tag {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 2px solid transparent;
      transition: border-color 0.2s, background 0.2s;
    }
    .player-tag.active {
      border-color: #4a9eff;
      background: rgba(74,158,255,0.08);
    }
    .dot {
      width: 14px; height: 14px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot.red { background: #E63946; }
    .dot.yellow { background: #FFD166; }
    .name { color: #fff; font-size: 0.9rem; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .score { color: #4a9eff; font-weight: 700; font-size: 1rem; }
    .turn-msg { color: #8aa3bc; font-size: 0.9rem; text-align: center; }

    .board-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    /* OVERLAY */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(13,27,42,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      backdrop-filter: blur(4px);
    }
    .overlay-card {
      background: #1B2A3B;
      border-radius: 20px;
      padding: 2.5rem;
      text-align: center;
      box-shadow: 0 16px 48px rgba(0,0,0,0.5);
      min-width: 280px;
      animation: pop-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes pop-in {
      from { transform: scale(0.7); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }
    .result-icon { font-size: 3rem; margin-bottom: 0.5rem; }
    .big-disc {
      display: inline-block;
      width: 64px; height: 64px;
      border-radius: 50%;
    }
    .big-disc.red { background: radial-gradient(circle at 35% 35%, #ff6b76, #E63946); box-shadow: 0 0 24px #E6394688; }
    .big-disc.yellow { background: radial-gradient(circle at 35% 35%, #ffe599, #FFD166); box-shadow: 0 0 24px #FFD16688; }
    .result-text { color: #fff; font-size: 1.6rem; margin: 0.5rem 0; }
    .result-sub { color: #FFD166; font-size: 1rem; margin: 0; }
    .overlay-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem; }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .primary { background: #4a9eff; color: #fff; }
    .primary:hover { background: #3a8fee; }
    .secondary { background: #2a3d52; color: #8aa3bc; }
    .secondary:hover { background: #3a4d62; color: #fff; }
  `],
})
export class GameComponent implements OnInit, OnDestroy {
  roomCode = '';
  state = this.ws.gameState;
  lastMove = signal<{ row: number; col: number } | null>(null);

  isMyTurn = computed(() => {
    const s = this.state();
    return s.myColor !== null && s.currentTurn === s.myColor;
  });

  currentTurnName = computed(() => {
    const s = this.state();
    return s.currentTurn === 'red' ? s.redPlayer : s.yellowPlayer;
  });

  winnerName = computed(() => {
    const s = this.state();
    if (!s.winner || s.winner === 'draw') return '';
    return s.winner === 'red' ? s.redPlayer : s.yellowPlayer;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ws: WebSocketService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.roomCode = (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase();
    const token = this.auth.getToken() ?? '';
    const username = this.auth.getUsername() ?? '';
    this.ws.connect(this.roomCode, token, username);

    // Track last move for drop animation
    let prevBoard = this.state().board;
    const effect = setInterval(() => {
      const cur = this.state().board;
      if (cur !== prevBoard) {
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 7; c++) {
            if (cur[r][c] !== 0 && prevBoard[r][c] === 0) {
              this.lastMove.set({ row: r, col: c });
            }
          }
        }
        prevBoard = cur;
      }
    }, 100);
    (this as any)._boardInterval = effect;
  }

  ngOnDestroy(): void {
    clearInterval((this as any)._boardInterval);
    this.ws.disconnect();
  }

  onColumnClick(col: number): void {
    this.ws.sendMove(col);
  }

  rematch(): void {
    this.ws.sendRematch();
  }

  surrender(): void {
    this.ws.sendSurrender();
  }

  goLobby(): void {
    this.router.navigate(['/lobby']);
  }
}
