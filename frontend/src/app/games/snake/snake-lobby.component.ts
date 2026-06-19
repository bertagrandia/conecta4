import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SnakeRoomService } from './services/snake-room.service';
import { SnakeRoomSummary } from './models';

@Component({
  selector: 'app-snake-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="lobby-bg">
      <header class="lobby-header">
        <span class="brand">🐍 Snake Arena</span>
      </header>

      <main class="lobby-main">
        <section class="panel public-panel">
          <h2>Sala Pública</h2>
          <p class="subtitle">Únete al mapa compartido con el resto de jugadores conectados.</p>
          <div class="public-rooms" *ngIf="publicRooms().length; else noPublic">
            <div class="room-row" *ngFor="let room of publicRooms()">
              <span class="room-id">{{ room.room_id }}</span>
              <span class="room-count">{{ room.player_count }} jugador(es)</span>
              <button (click)="joinRoom(room.room_id)">Unirse</button>
            </div>
          </div>
          <ng-template #noPublic>
            <p class="empty">No hay jugadores ahora mismo. ¡Sé el primero!</p>
          </ng-template>
          <button class="primary" (click)="joinRoom('PUBLIC')">Unirse a Sala Pública</button>
        </section>

        <section class="panel private-panel">
          <h2>Sala Privada</h2>
          <p class="subtitle">Crea una sala con código para jugar solo con tus amigos.</p>

          <div class="created-room" *ngIf="createdRoom() as room">
            <span class="code-label">Código de sala</span>
            <span class="code">{{ room.room_id }}</span>
            <button class="primary" (click)="joinRoom(room.room_id)">Entrar a la sala</button>
          </div>
          <button class="secondary" *ngIf="!createdRoom()" [disabled]="creating()" (click)="createRoom()">
            {{ creating() ? 'Creando...' : 'Crear Sala Privada' }}
          </button>

          <div class="join-form">
            <label>Unirse con código</label>
            <div class="join-row">
              <input
                type="text"
                maxlength="6"
                placeholder="ABC123"
                [(ngModel)]="joinCode"
                (keyup.enter)="joinByCode()"
              />
              <button (click)="joinByCode()" [disabled]="joining()">Unirse</button>
            </div>
            <span class="error" *ngIf="error()">{{ error() }}</span>
          </div>
        </section>
      </main>

      <a class="back-link" routerLink="/">← Volver al inicio</a>
    </div>
  `,
  styles: [`
    .lobby-bg { min-height: 100vh; background: #0B0E14; display: flex; flex-direction: column; align-items: center; font-family: 'Consolas', monospace; }
    .lobby-header { padding: 1.5rem; }
    .brand { color: #39FF88; font-size: 1.4rem; font-weight: 700; letter-spacing: 1px; }
    .lobby-main { display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; padding: 1rem 2rem 2rem; }
    .panel {
      background: #11151D; border: 1px solid #1A1F2B; border-radius: 16px; padding: 2rem;
      width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .panel h2 { color: #d4f5c8; margin: 0 0 0.3rem; }
    .subtitle { color: #7AAF72; font-size: 0.85rem; margin-bottom: 1.2rem; }
    .empty { color: #5C7BFF; font-size: 0.85rem; margin-bottom: 1rem; }
    .public-rooms { margin-bottom: 1.2rem; }
    .room-row {
      display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #1A1F2B;
    }
    .room-id { color: #39FF88; font-weight: 700; flex: 1; }
    .room-count { color: #7AAF72; font-size: 0.78rem; }
    button {
      padding: 0.65rem 1rem; border-radius: 8px; border: none; cursor: pointer;
      font-size: 0.88rem; font-weight: 600; transition: opacity 0.2s; color: #fff;
    }
    button.primary { background: #4DB349; width: 100%; margin-top: 0.4rem; }
    button.secondary { background: #1A1F2B; color: #d4f5c8; width: 100%; border: 1px solid #2A4A22; }
    .room-row button { background: #5C7BFF; padding: 0.4rem 0.8rem; }
    button:hover:not(:disabled) { opacity: 0.85; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .created-room {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      background: #0B0E14; border: 1px solid #2A4A22; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;
    }
    .code-label { color: #7AAF72; font-size: 0.75rem; letter-spacing: 1px; }
    .code { color: #FFD15C; font-size: 1.6rem; font-weight: 700; letter-spacing: 4px; }
    .join-form { margin-top: 1.5rem; }
    .join-form label { display: block; color: #7AAF72; font-size: 0.8rem; margin-bottom: 6px; }
    .join-row { display: flex; gap: 8px; }
    .join-row input {
      flex: 1; padding: 0.6rem 0.8rem; background: #0B0E14; border: 1px solid #2A4A22; border-radius: 8px;
      color: #d4f5c8; text-transform: uppercase; letter-spacing: 2px; font-family: inherit;
    }
    .join-row input:focus { outline: none; border-color: #4DB349; }
    .join-row button { background: #5C7BFF; }
    .error { display: block; color: #FF5C5C; font-size: 0.78rem; margin-top: 6px; }
    .back-link { color: #7AAF72; text-decoration: none; margin-bottom: 2rem; font-size: 0.85rem; }
    .back-link:hover { color: #d4f5c8; }
  `],
})
export class SnakeLobbyComponent implements OnInit, OnDestroy {
  publicRooms = signal<SnakeRoomSummary[]>([]);
  createdRoom = signal<SnakeRoomSummary | null>(null);
  creating = signal(false);
  joining = signal(false);
  error = signal('');
  joinCode = '';

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private rooms: SnakeRoomService, private router: Router) {}

  ngOnInit(): void {
    this.refreshRooms();
    this.pollHandle = setInterval(() => this.refreshRooms(), 3000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  refreshRooms(): void {
    this.rooms.listPublicRooms().subscribe({
      next: (rooms) => this.publicRooms.set(rooms),
      error: () => {},
    });
  }

  createRoom(): void {
    this.creating.set(true);
    this.error.set('');
    this.rooms.createPrivateRoom().subscribe({
      next: (room) => {
        this.createdRoom.set(room);
        this.creating.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.detail ?? 'No se pudo crear la sala');
        this.creating.set(false);
      },
    });
  }

  joinByCode(): void {
    const code = this.joinCode.trim().toUpperCase();
    if (!code) return;
    this.joining.set(true);
    this.error.set('');
    this.rooms.getRoom(code).subscribe({
      next: (room) => {
        this.joining.set(false);
        this.joinRoom(room.room_id);
      },
      error: () => {
        this.joining.set(false);
        this.error.set('Sala no encontrada');
      },
    });
  }

  joinRoom(roomId: string): void {
    this.router.navigate(['/snake/game', roomId]);
  }
}
