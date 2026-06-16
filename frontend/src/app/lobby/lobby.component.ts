import { Component, signal, OnInit } from '@angular/core';
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
            <p class="sub">Crea una partida y comparte el código con un amigo.</p>

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
              <div class="waiting">
                <div class="spinner"></div>
                <span>Esperando oponente...</span>
              </div>
              <button class="btn ai-btn" (click)="playVsAI()">
                Jugar contra la IA
              </button>
            </ng-container>

            <span class="error" *ngIf="createError()">{{ createError() }}</span>
          </div>

          <!-- UNIRSE A SALA -->
          <div class="card">
            <h3>Unirse a sala</h3>
            <p class="sub">Introduce el código que te dio tu rival.</p>

            <form [formGroup]="joinForm" (ngSubmit)="joinRoom()">
              <input
                formControlName="code"
                type="text"
                placeholder="Ej: AB12CD"
                maxlength="6"
                style="text-transform:uppercase"
              />
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
    .lobby-bg {
      min-height: 100vh;
      background: #0D1B2A;
      display: flex;
      flex-direction: column;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      background: #1B2A3B;
      border-bottom: 1px solid #2a3d52;
    }
    .logo { display: flex; align-items: center; gap: 10px; }
    .brand { color: #fff; font-size: 1.2rem; font-weight: 700; }
    .disc { width: 22px; height: 22px; border-radius: 50%; display: inline-block; }
    .disc.red { background: #E63946; box-shadow: 0 0 8px #E63946aa; }
    .disc.yellow { background: #FFD166; box-shadow: 0 0 8px #FFD166aa; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .username { color: #8aa3bc; font-size: 0.9rem; }
    .logout-btn {
      background: transparent;
      border: 1px solid #2a3d52;
      color: #8aa3bc;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: border-color 0.2s, color 0.2s;
    }
    .logout-btn:hover { border-color: #E63946; color: #E63946; }
    .lobby-main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .cards-row {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .card {
      background: #1B2A3B;
      border-radius: 16px;
      padding: 2rem;
      width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h3 { color: #fff; margin: 0; font-size: 1.2rem; }
    .sub { color: #8aa3bc; font-size: 0.88rem; margin: 0; }
    input {
      width: 100%;
      padding: 0.65rem 0.9rem;
      background: #0D1B2A;
      border: 1px solid #2a3d52;
      border-radius: 8px;
      color: #fff;
      font-size: 1rem;
      letter-spacing: 4px;
      box-sizing: border-box;
      text-align: center;
    }
    input:focus { outline: none; border-color: #4a9eff; }
    .btn {
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .primary { background: #4a9eff; color: #fff; }
    .primary:hover:not(:disabled) { background: #3a8fee; }
    .ai-btn { background: #2a3d52; color: #FFD166; border: 1px solid #FFD166; }
    .ai-btn:hover { background: #3a5268; }
    .room-code-box {
      background: #0D1B2A;
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
      border: 1px solid #2a3d52;
    }
    .room-label { display: block; color: #8aa3bc; font-size: 0.78rem; margin-bottom: 4px; }
    .room-code { color: #4a9eff; font-size: 2rem; font-weight: 700; letter-spacing: 6px; }
    .waiting {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #8aa3bc;
      font-size: 0.9rem;
    }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid #2a3d52;
      border-top-color: #4a9eff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error { color: #E63946; font-size: 0.82rem; }
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    @media (max-width: 700px) { .cards-row { flex-direction: column; } .card { width: 100%; } }
  `],
})
export class LobbyComponent implements OnInit {
  createdRoom = signal<string | null>(null);
  loadingCreate = signal(false);
  loadingJoin = signal(false);
  createError = signal('');
  joinError = signal('');
  username = signal('');

  joinForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  constructor(
    private fb: FormBuilder,
    private game: GameService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.username.set(this.auth.getUsername() ?? '');
  }

  createRoom(): void {
    this.loadingCreate.set(true);
    this.createError.set('');
    this.game.createRoom(false).subscribe({
      next: (room) => {
        this.createdRoom.set(room.code);
        this.loadingCreate.set(false);
        this.pollRoom(room.code);
      },
      error: (e) => {
        this.createError.set(e.error?.detail ?? 'Error al crear sala');
        this.loadingCreate.set(false);
      },
    });
  }

  private pollRoom(code: string): void {
    const interval = setInterval(() => {
      this.game.getRoom(code).subscribe({
        next: (room) => {
          if (room.status === 'playing') {
            clearInterval(interval);
            this.router.navigate(['/game', code]);
          }
        },
        error: () => clearInterval(interval),
      });
    }, 1500);
  }

  playVsAI(): void {
    const code = this.createdRoom();
    if (!code) return;
    this.game.enableAI(code).subscribe({
      next: () => this.router.navigate(['/game', code]),
      error: (e) => this.createError.set(e.error?.detail ?? 'Error'),
    });
  }

  joinRoom(): void {
    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }
    const code = this.joinForm.value.code!.toUpperCase();
    this.loadingJoin.set(true);
    this.joinError.set('');
    this.game.joinRoom(code).subscribe({
      next: () => this.router.navigate(['/game', code]),
      error: (e) => {
        this.joinError.set(e.error?.detail ?? 'Error al unirse');
        this.loadingJoin.set(false);
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
