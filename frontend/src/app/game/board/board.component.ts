import {
  Component, Input, Output, EventEmitter, signal, computed, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Board, PlayerColor } from '../../models';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-wrapper">
      <div class="preview-row">
        <div *ngFor="let col of cols" class="preview-cell"
          (mouseenter)="hoveredCol.set(col)" (mouseleave)="hoveredCol.set(-1)" (click)="handleClick(col)">
          <div class="preview-disc"
            [class.visible]="hoveredCol() === col && canPlay"
            [class.red]="myColor === 'red'"
            [class.yellow]="myColor === 'yellow'">
          </div>
        </div>
      </div>

      <div class="board">
        <div *ngFor="let col of cols" class="column"
          [class.hovered]="hoveredCol() === col && canPlay"
          (mouseenter)="hoveredCol.set(col)" (mouseleave)="hoveredCol.set(-1)" (click)="handleClick(col)">
          <div *ngFor="let row of rows" class="cell" [class.winning]="isWinning(row, col)">
            <div class="disc"
              [class.red]="board[row][col] === 1"
              [class.yellow]="board[row][col] === 2"
              [class.drop]="isLastDrop(row, col)">
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .board-wrapper { display: flex; flex-direction: column; align-items: center; gap: 4px; user-select: none; }

    .preview-row { display: flex; gap: 6px; padding: 0 6px; }
    .preview-cell { width: 64px; height: 36px; display: flex; align-items: flex-end; justify-content: center; cursor: pointer; }
    .preview-disc { width: 46px; height: 46px; border-radius: 50%; opacity: 0; transition: opacity 0.15s; }
    .preview-disc.visible { opacity: 0.6; }
    .preview-disc.red    { background: #C0392B; }
    .preview-disc.yellow { background: #E8B84B; }

    .board {
      display: flex; gap: 6px; background: #1E3D18;
      border-radius: 16px; padding: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(77,179,73,0.1);
      border: 1px solid #2A4A22;
    }
    .column {
      display: flex; flex-direction: column; gap: 6px;
      border-radius: 8px; padding: 4px; cursor: pointer; transition: background 0.15s;
    }
    .column.hovered { background: rgba(77,179,73,0.1); }
    .cell {
      width: 64px; height: 64px; border-radius: 50%;
      background: #0B1A08; display: flex; align-items: center; justify-content: center;
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);
    }
    .cell.winning { animation: pulse-cell 0.6s ease-in-out infinite alternate; }
    @keyframes pulse-cell {
      from { background: #0B1A08; }
      to   { background: #1a3d15; }
    }
    .disc { width: 54px; height: 54px; border-radius: 50%; background: transparent; transition: background 0.15s; }
    .disc.red {
      background: radial-gradient(circle at 35% 35%, #e05050, #C0392B);
      box-shadow: 0 3px 10px rgba(192,57,43,0.6);
    }
    .disc.yellow {
      background: radial-gradient(circle at 35% 35%, #f5d080, #E8B84B);
      box-shadow: 0 3px 10px rgba(232,184,75,0.6);
    }
    .disc.drop { animation: drop 0.3s ease-in; }
    @keyframes drop {
      from { transform: translateY(-400px); opacity: 0.7; }
      to   { transform: translateY(0); opacity: 1; }
    }
    .cell.winning .disc.red    { animation: glow-red    0.5s ease-in-out infinite alternate; }
    .cell.winning .disc.yellow { animation: glow-yellow 0.5s ease-in-out infinite alternate; }
    @keyframes glow-red    { from { filter: brightness(1); } to { filter: brightness(1.6) drop-shadow(0 0 10px #C0392B); } }
    @keyframes glow-yellow { from { filter: brightness(1); } to { filter: brightness(1.6) drop-shadow(0 0 10px #E8B84B); } }

    @media (max-width: 520px) {
      .cell { width: 44px; height: 44px; }
      .disc { width: 36px; height: 36px; }
      .preview-cell { width: 44px; }
      .preview-disc { width: 32px; height: 32px; }
      .board { gap: 4px; padding: 8px; }
      .column { gap: 4px; }
    }
  `],
})
export class BoardComponent implements OnChanges {
  @Input() board: Board = Array.from({ length: 6 }, () => Array(7).fill(0));
  @Input() myColor: PlayerColor | null = null;
  @Input() canPlay = false;
  @Input() winningCells: [number, number][] = [];
  @Input() lastMove: { row: number; col: number } | null = null;
  @Output() columnClicked = new EventEmitter<number>();

  hoveredCol = signal(-1);
  winSet = computed(() => new Set(this.winningCells.map(([r, c]) => `${r},${c}`)));
  rows = [0, 1, 2, 3, 4, 5];
  cols = [0, 1, 2, 3, 4, 5, 6];

  private prevLastMove: { row: number; col: number } | null = null;
  dropKey = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lastMove'] && this.lastMove) {
      const key = `${this.lastMove.row},${this.lastMove.col}`;
      if (key !== (this.prevLastMove ? `${this.prevLastMove.row},${this.prevLastMove.col}` : null)) {
        this.dropKey.set(key);
        this.prevLastMove = this.lastMove;
        setTimeout(() => this.dropKey.set(null), 400);
      }
    }
  }

  isWinning(row: number, col: number): boolean { return this.winSet().has(`${row},${col}`); }
  isLastDrop(row: number, col: number): boolean { return this.dropKey() === `${row},${col}`; }
  handleClick(col: number): void { if (this.canPlay) this.columnClicked.emit(col); }
}
