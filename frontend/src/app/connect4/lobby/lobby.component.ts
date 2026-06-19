import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../services/game.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="lobby-bg">
      <header class="top-bar">
        <div class="logo">
          <span class="disc red"></span>
          <span class="brand">Conecta 4</span>
          <span class="disc yellow"></span>
          <span class="disc blue"></span>
        </div>
        <div class="user-info">
          <span class="username">{{ username() }}</span>
          <button class="logout-btn" (click)="logout()">Salir</button>
        </div>
      </header>

      <main class="lobby-main">
        <div class="cards-row">
          <!-- CREAR SALA -->
          <div class="card">
            <h3>Crear sala</h3>
            <p class="sub">Crea una partida para hasta 3 jugadores.</p>

            <ng-container *ngIf="!createdRoom()">
              <button class="btn primary" (click)="createRoom()" [disabled]="loadingCreate()">
                {{ loadingCreate() ? 'Creando...' : 'Crear sala' }}
              </button>
            </ng-container>

            <ng-container *ngIf="createdRoom()">
              <div class="room-code-box">
                <span class="room-label">Código de sala</span>
                <span class="room-code">{{ createdRoom() }}</span>
              </div>

              <!-- Player count badge -->
              <div class="player-count-row">
                <span class="player-count-badge">
                  <span class="dot" [class.filled]="roomPlayerCount() >= 1"></span>
                  <span class="dot" [class.filled]="roomPlayerCount() >= 2"></span>
                  <span class="dot" [class.filled]="roomPlayerCount() >= 3"></span>
                  {{ roomPlayerCount() }}/3 jugadores
                </span>
                <span class="waiting-hint" *ngIf="roomPlayerCount() === 1">Esperando...</span>
                <span class="waiting-hint duo" *ngIf="roomPlayerCount() === 2">
                  Inicia ya o espera al 3er jugador
                </span>
                <span class="waiting-hint ready" *ngIf="roomPlayerCount() >= 3">¡Listos!</span>
              </div>

              <!-- Action buttons depend on player count -->
              <ng-container *ngIf="roomPlayerCount() === 1">
                <div class="waiting">
                  <div class="spinner"></div>
                  <span>Esperando oponente...</span>
                </div>
                <button class="btn ai-btn" (click)="playVsAI()">Jugar contra IA</button>
              </ng-container>

              <ng-container *ngIf="roomPlayerCount() >= 2">
                <button class="btn primary" (click)="startNow()" [disabled]="loadingStart()">
                  {{ loadingStart() ? 'Iniciando...' : 'Iniciar partida ya' }}
                </button>
                <button class="btn ai-btn" (click)="addAI()" [disabled]="loadingStart()">
                  Añadir IA como 3er jugador
                </button>
              </ng-container>
            </ng-container>

            <span class="error" *ngIf="createError()">{{ createError() }}</span>
          </div>

          <!-- UNIRSE A SALA -->
          <div class="card">
            <h3>Unirse a sala</h3>
            <p class="sub">Introduce el código que te dio tu rival.</p>

            <form [formGroup]="joinForm" (ngSubmit)="joinRoom()">
              <input formControlName="code" type="text" placeholder="Ej: AB12CD" maxlength="6" style="text-transform:uppercase" />
              <span class="error" *ngIf="joinForm.get('code')?.invalid && joinForm.get('code')?.touched">
                Código de 6 caracteres
              </span>
              <button class="btn primary" type="submit" [disabled]="loadingJoin()">
                {{ loadingJoin() ? 'Uniéndose...' : 'Unirse' }}
              </button>
            </form>

            <span class="error" *ngIf="joinError()">{{ joinError() }}</span>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .lobby-bg { min-height: 100vh; background: #0B1A08; display: flex; flex-direction: column; }
    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 2rem; background: #152B10; border-bottom: 1px solid #2A4A22;
    }
    .logo { display: flex; align-items: center; gap: 10px; }
    .brand { color: #d4f5c8; font-size: 1.2rem; font-weight: 700; }
    .disc { width: 22px; height: 22px; border-radius: 50%; display: inline-block; }
    .disc.red    { background: #C0392B; box-shadow: 0 0 8px #C0392Baa; }
    .disc.yellow { background: #E8B84B; box-shadow: 0 0 8px #E8B84Baa; }
    .disc.blue   { background: #4361EE; box-shadow: 0 0 8px #4361EEaa; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .username { color: #7AAF72; font-size: 0.9rem; }
    .logout-btn {
      background: transparent; border: 1px solid #2A4A22; color: #7AAF72;
      padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
      transition: border-color 0.2s, color 0.2s;
    }
    .logout-btn:hover { border-color: #C0392B; color: #C0392B; }
    .lobby-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .cards-row { display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; }
    .card {
      background: #152B10; border-radius: 16px; padding: 2rem; width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); border: 1px solid #2A4A22;
      display: flex; flex-direction: column; gap: 1rem;
    }
    h3 { color: #d4f5c8; margin: 0; font-size: 1.2rem; }
    .sub { color: #7AAF72; font-size: 0.88rem; margin: 0; }
    input {
      width: 100%; padding: 0.65rem 0.9rem; background: #0B1A08;
      border: 1px solid #2A4A22; border-radius: 8px; color: #d4f5c8;
      font-size: 1rem; letter-spacing: 4px; box-sizing: border-box; text-align: center;
    }
    input:focus { outline: none; border-color: #4DB349; }
    input::placeholder { color: #3d6b38; letter-spacing: normal; }
    .btn {
      width: 100%; padding: 0.75rem; border: none; border-radius: 8px;
      font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s, opacity 0.2s;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .primary { background: #4DB349; color: #fff; }
    .primary:hover:not(:disabled) { background: #3D9939; }
    .ai-btn { background: #1E3D18; color: #E8B84B; border: 1px solid #E8B84B; }
    .ai-btn:hover:not(:disabled) { background: #2A5222; }
    .room-code-box {
      background: #0B1A08; border-radius: 10px; padding: 1rem;
      text-align: center; border: 1px solid #2A4A22;
    }
    .room-label { display: block; color: #7AAF72; font-size: 0.78rem; margin-bottom: 4px; }
    .room-code { color: #4DB349; font-size: 2rem; font-weight: 700; letter-spacing: 6px; }

    .player-count-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .player-count-badge {
      display: flex; align-items: center; gap: 5px;
      background: #0B1A08; border: 1px solid #2A4A22; border-radius: 20px;
      padding: 4px 12px; font-size: 0.82rem; color: #7AAF72;
    }
    .dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #2A4A22; border: 1px solid #3d6b38; transition: background 0.3s;
    }
    .dot.filled { background: #4DB349; border-color: #4DB349; }
    .waiting-hint { font-size: 0.78rem; color: #7AAF72; }
    .waiting-hint.duo { color: #E8B84B; }
    .waiting-hint.ready { color: #4DB349; font-weight: 600; }

    .waiting { display: flex; align-items: center; gap: 10px; color: #7AAF72; font-size: 0.9rem; }
    .spinner {
      width: 18px; height: 18px; border: 2px solid #2A4A22;
      border-top-color: #4DB349; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error { color: #C0392B; font-size: 0.82rem; }
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    @media (max-width: 700px) { .cards-row { flex-direction: column; } .card { width: 100%; } }
  `],
})
export class LobbyComponent implements OnInit, OnDestroy {
  createdRoom    = signal<string | null>(null);
  roomPlayerCount = signal(1);
  loadingCreate  = signal(false);
  loadingJoin    = signal(false);
  loadingStart   = signal(false);
  createError    = signal('');
  joinError      = signal('');
  username       = signal('');

  joinForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private fb: FormBuilder, private game: GameService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void { this.username.set(this.auth.getUsername() ?? ''); }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  createRoom(): void {
    this.loadingCreate.set(true);
    this.createError.set('');
    this.game.createRoom(false).subscribe({
      next: (room) => {
        this.createdRoom.set(room.code);
        this.roomPlayerCount.set(room.player_count);
        this.loadingCreate.set(false);
        this.pollRoom(room.code);
      },
      error: (e) => { this.createError.set(e.error?.detail ?? 'Error al crear sala'); this.loadingCreate.set(false); },
    });
  }

  private pollRoom(code: string): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.game.getRoom(code).subscribe({
        next: (room) => {
          this.roomPlayerCount.set(room.player_count);
          if (room.status === 'playing') {
            clearInterval(this.pollInterval!);
            this.router.navigate(['/connect4/game', code]);
          }
        },
        error: () => {
          if (this.pollInterval) clearInterval(this.pollInterval);
        },
      });
    }, 1500);
  }

  playVsAI(): void {
    const code = this.createdRoom();
    if (!code) return;
    this.game.enableAI(code).subscribe({
      next: () => { if (this.pollInterval) clearInterval(this.pollInterval); this.router.navigate(['/connect4/game', code]); },
      error: (e) => this.createError.set(e.error?.detail ?? 'Error'),
    });
  }

  addAI(): void {
    const code = this.createdRoom();
    if (!code) return;
    this.loadingStart.set(true);
    this.game.enableAI(code).subscribe({
      next: () => { if (this.pollInterval) clearInterval(this.pollInterval); this.router.navigate(['/connect4/game', code]); },
      error: (e) => { this.createError.set(e.error?.detail ?? 'Error'); this.loadingStart.set(false); },
    });
  }

  startNow(): void {
    const code = this.createdRoom();
    if (!code) return;
    this.loadingStart.set(true);
    this.game.startNow(code).subscribe({
      next: () => { if (this.pollInterval) clearInterval(this.pollInterval); this.router.navigate(['/connect4/game', code]); },
      error: (e) => { this.createError.set(e.error?.detail ?? 'Error al iniciar'); this.loadingStart.set(false); },
    });
  }

  joinRoom(): void {
    if (this.joinForm.invalid) { this.joinForm.markAllAsTouched(); return; }
    const code = this.joinForm.value.code!.toUpperCase();
    this.loadingJoin.set(true);
    this.joinError.set('');
    this.game.joinRoom(code).subscribe({
      next: (room) => {
        // If game started immediately (3rd player), navigate directly
        if (room.status === 'playing') {
          this.router.navigate(['/connect4/game', code]);
        } else {
          // 2nd player: go to game page — WebSocket will notify when game starts
          this.router.navigate(['/connect4/game', code]);
        }
      },
      error: (e) => { this.joinError.set(e.error?.detail ?? 'Error al unirse'); this.loadingJoin.set(false); },
    });
  }

  logout(): void { this.auth.logout(); }
}
