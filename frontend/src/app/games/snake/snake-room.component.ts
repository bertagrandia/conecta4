import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../connect4/services/auth.service';
import { SnakeWebsocketService } from './services/snake-websocket.service';
import { DeathMessage, SnakeState } from './models';

@Component({
  selector: 'app-snake-room',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="arena-wrapper">
      <canvas #canvas class="arena-canvas"></canvas>
      <canvas #minimap class="minimap"></canvas>

      <div class="hud hud-top-left">
        <div class="hud-label">LONGITUD</div>
        <div class="hud-value">{{ myLength() }}</div>
      </div>

      <div class="hud hud-top-right leaderboard">
        <div class="hud-label">RANKING</div>
        <div class="lb-row" *ngFor="let entry of leaderboard(); let i = index" [class.me]="entry.username === username">
          <span class="lb-rank">{{ i + 1 }}</span>
          <span class="lb-name">{{ entry.username }}</span>
          <span class="lb-len">{{ entry.length }}</span>
        </div>
      </div>

      <div class="hud hint" *ngIf="!death()">CLICK / ESPACIO = BOOST</div>
      <div class="conn-toast" *ngIf="!connected()">Reconectando...</div>

      <div class="death-overlay" *ngIf="death() as d">
        <div class="death-card">
          <h2>{{ deathTitle(d) }}</h2>
          <p class="death-length">Longitud final: {{ d.final_length }}</p>
          <button (click)="respawn()">Jugar de nuevo</button>
          <button class="secondary" (click)="goLobby()">Volver al Lobby</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .arena-wrapper {
      position: fixed;
      inset: 0;
      background: #0B0E14;
      overflow: hidden;
      font-family: 'Consolas', 'Courier New', monospace;
    }
    .arena-canvas {
      position: absolute;
      inset: 0;
      cursor: crosshair;
    }
    .minimap {
      position: absolute;
      right: 16px;
      bottom: 16px;
      width: 150px;
      height: 150px;
      border-radius: 8px;
      border: 1px solid #2A4A22;
      box-shadow: 0 4px 18px rgba(0,0,0,0.5);
    }
    .hud {
      position: absolute;
      color: #d4f5c8;
      background: rgba(11,14,20,0.72);
      border: 1px solid #1A1F2B;
      border-radius: 8px;
      padding: 8px 14px;
      backdrop-filter: blur(2px);
      pointer-events: none;
    }
    .hud-top-left { top: 16px; left: 16px; }
    .hud-label { font-size: 0.7rem; letter-spacing: 2px; color: #5C7BFF; margin-bottom: 2px; }
    .hud-value { font-size: 1.6rem; font-weight: 700; }
    .hud-top-right { top: 16px; right: 16px; min-width: 170px; }
    .leaderboard .lb-row {
      display: flex; gap: 8px; align-items: center; font-size: 0.82rem; padding: 2px 0;
    }
    .leaderboard .lb-row.me { color: #39FF88; font-weight: 700; }
    .lb-rank { width: 16px; color: #7AAF72; }
    .lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-len { color: #5CC9FF; }
    .hint {
      bottom: 16px; left: 16px; font-size: 0.72rem; letter-spacing: 1px; color: #7AAF72;
    }
    .conn-toast {
      position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
      background: #C0392Bcc; color: #fff; padding: 6px 16px; border-radius: 8px; font-size: 0.85rem;
    }
    .death-overlay {
      position: absolute; inset: 0; background: rgba(11,14,20,0.85);
      display: flex; align-items: center; justify-content: center;
    }
    .death-card {
      background: #152B10; border: 1px solid #2A4A22; border-radius: 16px;
      padding: 2.5rem; text-align: center; min-width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .death-card h2 { color: #FF5C5C; margin: 0 0 0.5rem; }
    .death-length { color: #d4f5c8; margin-bottom: 1.5rem; }
    .death-card button {
      width: 100%; padding: 0.7rem; margin-top: 0.6rem; border: none; border-radius: 8px;
      font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .death-card button:not(.secondary) { background: #4DB349; color: #fff; }
    .death-card button.secondary { background: transparent; color: #7AAF72; border: 1px solid #2A4A22; }
    .death-card button:hover { opacity: 0.85; }
  `],
})
export class SnakeRoomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('minimap', { static: true }) minimapRef!: ElementRef<HTMLCanvasElement>;

  roomId = '';
  username = '';

  private ctx!: CanvasRenderingContext2D;
  private miniCtx!: CanvasRenderingContext2D;
  private canvasW = 0;
  private canvasH = 0;
  private readonly minimapSize = 150;
  private camera = { x: 1500, y: 1500 };
  private rafId = 0;
  private boosting = false;

  private state = this.ws.state;
  connected = computed(() => this.state().connected);
  death = computed(() => this.state().death);
  leaderboard = computed(() => this.state().latestSnapshot?.leaderboard ?? []);
  myLength = computed(() => {
    const st = this.state();
    const snake = st.latestSnapshot?.snakes.find((s) => s.id === st.yourSnakeId);
    return snake ? snake.length : 0;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ws: SnakeWebsocketService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.roomId = (this.route.snapshot.paramMap.get('code') ?? 'PUBLIC').toUpperCase();
    this.username = this.auth.getUsername() ?? '';
    this.ws.connect(this.roomId, this.auth.getToken() ?? '');
  }

  ngAfterViewInit(): void {
    this.resizeCanvas();
    this.minimapRef.nativeElement.width = this.minimapSize;
    this.minimapRef.nativeElement.height = this.minimapSize;
    this.miniCtx = this.minimapRef.nativeElement.getContext('2d')!;

    window.addEventListener('resize', this.onResize);
    const canvas = this.canvasRef.nativeElement;
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onBoostStart);
    window.addEventListener('mouseup', this.onBoostEnd);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.rafId = requestAnimationFrame(this.renderFrame);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    const canvas = this.canvasRef?.nativeElement;
    canvas?.removeEventListener('mousemove', this.onMouseMove);
    canvas?.removeEventListener('mousedown', this.onBoostStart);
    window.removeEventListener('mouseup', this.onBoostEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.ws.disconnect();
  }

  respawn(): void {
    this.ws.respawn();
  }

  goLobby(): void {
    this.router.navigate(['/snake/lobby']);
  }

  deathTitle(d: DeathMessage): string {
    if (d.killed_by === 'wall') return 'Has chocado con la pared';
    if (d.killed_by === 'self') return 'Has chocado contigo mismo';
    return `Te ha matado ${d.killed_by}`;
  }

  private onResize = (): void => this.resizeCanvas();

  private onMouseMove = (ev: MouseEvent): void => {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const angleRad = Math.atan2(my - this.canvasH / 2, mx - this.canvasW / 2);
    this.ws.setDirection((angleRad * 180) / Math.PI);
  };

  private onBoostStart = (): void => {
    this.boosting = true;
    this.ws.setBoost(true);
  };

  private onBoostEnd = (): void => {
    if (this.boosting) {
      this.boosting = false;
      this.ws.setBoost(false);
    }
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.code === 'Space') {
      ev.preventDefault();
      this.onBoostStart();
    }
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    if (ev.code === 'Space') {
      ev.preventDefault();
      this.onBoostEnd();
    }
  };

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvasW = window.innerWidth;
    this.canvasH = window.innerHeight;
    canvas.width = this.canvasW * dpr;
    canvas.height = this.canvasH * dpr;
    canvas.style.width = `${this.canvasW}px`;
    canvas.style.height = `${this.canvasH}px`;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private renderFrame = (now: number): void => {
    this.draw(now);
    this.rafId = requestAnimationFrame(this.renderFrame);
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const st = this.state();

    ctx.fillStyle = '#0B0E14';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    const latest = st.latestSnapshot;
    if (!latest) {
      this.drawGrid();
      return;
    }

    const prev = st.previousSnapshot;
    let t = 1;
    if (prev) {
      const span = latest.receivedAt - prev.receivedAt;
      const elapsed = now - latest.receivedAt;
      t = span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 1;
    }

    const mySnakeId = st.yourSnakeId;
    const interpolated = latest.snakes.map((s) => ({
      ...s,
      segments: this.interpolateSegments(
        prev?.snakes.find((p) => p.id === s.id),
        s,
        t,
      ),
    }));

    const mine = interpolated.find((s) => s.id === mySnakeId);
    if (mine && mine.segments.length) {
      const [hx, hy] = mine.segments[0];
      this.camera.x += (hx - this.camera.x) * 0.18;
      this.camera.y += (hy - this.camera.y) * 0.18;
    }

    this.drawGrid();
    this.drawBounds(st.mapSize);
    this.drawFood(latest.food.map((f) => ({ ...f })));
    this.drawSnakes(interpolated, mySnakeId);
    this.drawMinimap(latest.snakes, st.mapSize, mySnakeId);
  }

  private interpolateSegments(
    prevSnake: SnakeState | undefined,
    latestSnake: SnakeState,
    t: number,
  ): [number, number][] {
    if (!prevSnake) return latestSnake.segments;
    const n = Math.min(prevSnake.segments.length, latestSnake.segments.length);
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const [px, py] = prevSnake.segments[i];
      const [lx, ly] = latestSnake.segments[i];
      out.push([px + (lx - px) * t, py + (ly - py) * t]);
    }
    for (let i = n; i < latestSnake.segments.length; i++) out.push(latestSnake.segments[i]);
    return out;
  }

  private worldToScreen(x: number, y: number): [number, number] {
    return [x - this.camera.x + this.canvasW / 2, y - this.camera.y + this.canvasH / 2];
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    const gridSize = 120;
    const offsetX = ((this.camera.x % gridSize) + gridSize) % gridSize;
    const offsetY = ((this.camera.y % gridSize) + gridSize) % gridSize;
    ctx.strokeStyle = '#1A1F2B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -offsetX; x < this.canvasW; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvasH);
    }
    for (let y = -offsetY; y < this.canvasH; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasW, y);
    }
    ctx.stroke();
  }

  private drawBounds(mapSize: number): void {
    const ctx = this.ctx;
    const [x0, y0] = this.worldToScreen(0, 0);
    const [x1, y1] = this.worldToScreen(mapSize, mapSize);
    ctx.save();
    ctx.strokeStyle = '#FF5C5C66';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#FF5C5C';
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  private drawFood(food: { x: number; y: number; value: number }[]): void {
    const ctx = this.ctx;
    for (const f of food) {
      const [sx, sy] = this.worldToScreen(f.x, f.y);
      if (sx < -30 || sx > this.canvasW + 30 || sy < -30 || sy > this.canvasH + 30) continue;
      const radius = 4 + f.value * 2.5;
      const color = f.value >= 3 ? '#FF5CC4' : f.value === 2 ? '#FFD15C' : '#5CFFE0';
      ctx.save();
      ctx.shadowBlur = 8 + f.value * 4;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawSnakes(snakes: SnakeState[], mySnakeId: string | null): void {
    const others = snakes.filter((s) => s.id !== mySnakeId);
    const mine = snakes.find((s) => s.id === mySnakeId);
    for (const s of others) this.drawSnakeBody(s, false);
    if (mine) this.drawSnakeBody(mine, true);
  }

  private drawSnakeBody(snake: SnakeState, isSelf: boolean): void {
    const ctx = this.ctx;
    const pts = snake.segments.map(([x, y]) => this.worldToScreen(x, y));
    if (pts.length < 1) return;

    const visible = pts.some(
      ([x, y]) => x > -120 && x < this.canvasW + 120 && y > -120 && y < this.canvasH + 120,
    );
    if (!visible) return;

    const thickness = Math.max(6, Math.min(26, 6 + snake.length / 25));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = isSelf ? 1 : 0.78;
    ctx.shadowBlur = isSelf ? 18 : 4;
    ctx.shadowColor = isSelf ? '#FFFFFF' : snake.color;
    ctx.strokeStyle = snake.color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();

    if (isSelf) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(2, thickness * 0.25);
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
    ctx.restore();

    const [hx, hy] = pts[0];
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    ctx.font = '12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4f5c8';
    ctx.fillText(snake.username, hx, hy - thickness - 6);
    ctx.restore();
  }

  private drawMinimap(snakes: SnakeState[], mapSize: number, mySnakeId: string | null): void {
    const ctx = this.miniCtx;
    if (!ctx) return;
    const size = this.minimapSize;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(11,14,20,0.85)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#2A4A22';
    ctx.strokeRect(0, 0, size, size);

    for (const s of snakes) {
      if (!s.segments.length) continue;
      const [wx, wy] = s.segments[0];
      const x = (wx / mapSize) * size;
      const y = (wy / mapSize) * size;
      const isSelf = s.id === mySnakeId;
      ctx.fillStyle = isSelf ? '#FFFFFF' : s.color;
      ctx.beginPath();
      ctx.arc(x, y, isSelf ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
