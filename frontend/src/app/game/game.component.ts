import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BoardComponent } from './board/board.component';
import { WebSocketService } from '../services/websocket.service';
import { AuthService } from '../services/auth.service';

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

      <div class="status-bar">
        <div class="player-tag" [class.active]="state().currentTurn === 'red' && state().status === 'playing'">
          <span class="dot red"></span>
          <span class="name">{{ state().redPlayer ?? 'Esperando...' }}</span>
          <span class="score">{{ state().scores[state().redPlayer || ''] || 0 }}</span>
        </div>
        <div class="turn-msg">
          <ng-container *ngIf="state().status === 'playing'">
            <ng-container *ngIf="isMyTurn(); else notMyTurn">¡Tu turno!</ng-container>
            <ng-template #notMyTurn>Turno de {{ currentTurnName() }}</ng-template>
          </ng-container>
          <ng-container *ngIf="state().status === 'waiting'">Esperando oponente...</ng-container>
          <ng-container *ngIf="state().status === 'finished'">Partida terminada</ng-container>
        </div>
        <div class="player-tag" [class.active]="state().currentTurn === 'yellow' && state().status === 'playing'">
          <span class="dot yellow"></span>
          <span class="name">{{ state().yellowPlayer ?? 'Esperando...' }}</span>
          <span class="score">{{ state().scores[state().yellowPlayer || ''] || 0 }}</span>
        </div>
      </div>

      <div class="board-area">
        <app-board
          [board]="state().board"
          [myColor]="state().myColor"
          [canPlay]="isMyTurn() && state().status === 'playing'"
          [winningCells]="state().winningCells"
          [lastMove]="lastMove()"
          (columnClicked)="onColumnClick($event)">
        </app-board>
      </div>

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
              <div class="big-disc-wrap">
                <span class="big-disc" [class.red]="state().winner === 'red'" [class.yellow]="state().winner === 'yellow'"></span>
              </div>
              <h2 class="result-text">{{ winnerName() }} gana!</h2>
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
    .game-bg { min-height: 100vh; background: #0B1A08; display: flex; flex-direction: column; align-items: center; }
    .top-bar {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 1.5rem; background: #152B10; border-bottom: 1px solid #2A4A22; box-sizing: border-box;
    }
    .back-btn {
      background: transparent; border: 1px solid #2A4A22; color: #7AAF72;
      padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
      transition: border-color 0.2s, color 0.2s;
    }
    .back-btn:hover { border-color: #4DB349; color: #4DB349; }
    .room-label { color: #7AAF72; font-size: 0.9rem; }
    .room-label strong { color: #4DB349; letter-spacing: 2px; }
    .surrender-btn {
      background: transparent; border: 1px solid #C0392B; color: #C0392B;
      padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
    }
    .surrender-btn:hover { background: rgba(192,57,43,0.1); }

    .status-bar {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; max-width: 600px; padding: 1rem 1.5rem; box-sizing: border-box;
    }
    .player-tag {
      display: flex; align-items: center; gap: 8px; padding: 6px 12px;
      border-radius: 8px; border: 2px solid transparent; transition: border-color 0.2s, background 0.2s;
    }
    .player-tag.active { border-color: #4DB349; background: rgba(77,179,73,0.08); }
    .dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
    .dot.red    { background: #C0392B; }
    .dot.yellow { background: #E8B84B; }
    .name  { color: #d4f5c8; font-size: 0.9rem; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .score { color: #4DB349; font-weight: 700; font-size: 1rem; }
    .turn-msg { color: #7AAF72; font-size: 0.9rem; text-align: center; }

    .board-area { flex: 1; display: flex; align-items: center; justify-content: center; padding: 1rem; }

    .overlay {
      position: fixed; inset: 0; background: rgba(11,26,8,0.88);
      display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px);
    }
    .overlay-card {
      background: #152B10; border-radius: 20px; padding: 2.5rem; text-align: center;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6); min-width: 280px; border: 1px solid #2A4A22;
      animation: pop-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes pop-in { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .result-icon { font-size: 3rem; margin-bottom: 0.5rem; }
    .big-disc-wrap { margin-bottom: 0.75rem; }
    .big-disc { display: inline-block; width: 64px; height: 64px; border-radius: 50%; }
    .big-disc.red    { background: radial-gradient(circle at 35% 35%, #e05050, #C0392B); box-shadow: 0 0 24px #C0392B88; }
    .big-disc.yellow { background: radial-gradient(circle at 35% 35%, #f5d080, #E8B84B); box-shadow: 0 0 24px #E8B84B88; }
    .result-text { color: #d4f5c8; font-size: 1.6rem; margin: 0.5rem 0; }
    .result-sub  { color: #E8B84B; font-size: 1rem; margin: 0; }
    .overlay-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem; }
    .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .primary   { background: #4DB349; color: #fff; }
    .primary:hover   { background: #3D9939; }
    .secondary { background: #1E3D18; color: #7AAF72; border: 1px solid #2A4A22; }
    .secondary:hover { background: #2A5222; color: #d4f5c8; }
  `],
})
export class GameComponent implements OnInit, OnDestroy {
  roomCode = '';
  state = this.ws.gameState;
  lastMove = signal<{ row: number; col: number } | null>(null);

  isMyTurn     = computed(() => { const s = this.state(); return s.myColor !== null && s.currentTurn === s.myColor; });
  currentTurnName = computed(() => { const s = this.state(); return s.currentTurn === 'red' ? s.redPlayer : s.yellowPlayer; });
  winnerName   = computed(() => { const s = this.state(); if (!s.winner || s.winner === 'draw') return ''; return s.winner === 'red' ? s.redPlayer : s.yellowPlayer; });

  constructor(private route: ActivatedRoute, private router: Router, private ws: WebSocketService, private auth: AuthService) {}

  ngOnInit(): void {
    this.roomCode = (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase();
    this.ws.connect(this.roomCode, this.auth.getToken() ?? '', this.auth.getUsername() ?? '');
    let prevBoard = this.state().board;
    const effect = setInterval(() => {
      const cur = this.state().board;
      if (cur !== prevBoard) {
        for (let r = 0; r < 6; r++)
          for (let c = 0; c < 7; c++)
            if (cur[r][c] !== 0 && prevBoard[r][c] === 0)
              this.lastMove.set({ row: r, col: c });
        prevBoard = cur;
      }
    }, 100);
    (this as any)._boardInterval = effect;
  }

  ngOnDestroy(): void { clearInterval((this as any)._boardInterval); this.ws.disconnect(); }
  onColumnClick(col: number): void { this.ws.sendMove(col); }
  rematch(): void { this.ws.sendRematch(); }
  surrender(): void { this.ws.sendSurrender(); }
  goLobby(): void { this.router.navigate(['/lobby']); }
}
