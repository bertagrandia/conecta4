import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home-bg">
      <header class="home-header">
        <span class="brand">Mini Juegos</span>
      </header>

      <main class="cards-row">
        <a class="game-card connect4-card" routerLink="/connect4">
          <div class="icon-row">
            <span class="disc red"></span>
            <span class="disc yellow"></span>
            <span class="disc blue"></span>
          </div>
          <h2>Conecta 4</h2>
          <p>Hasta 3 jugadores, con IA opcional.</p>
        </a>

        <a class="game-card battleship-card" routerLink="/battleship">
          <div class="icon-row">
            <span class="ship-icon"></span>
          </div>
          <h2>Hundir la Flota</h2>
          <p>Coloca tu flota y hunde al rival.</p>
        </a>
      </main>
    </div>
  `,
  styles: [`
    .home-bg { min-height: 100vh; background: #0B1A08; display: flex; flex-direction: column; }
    .home-header {
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem; border-bottom: 1px solid #2A4A22;
    }
    .brand { color: #d4f5c8; font-size: 1.4rem; font-weight: 700; letter-spacing: 1px; }
    .cards-row {
      flex: 1; display: flex; gap: 2rem; align-items: center; justify-content: center;
      padding: 2rem; flex-wrap: wrap;
    }
    .game-card {
      background: #152B10; border-radius: 16px; padding: 2.5rem; width: 280px; height: 260px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); border: 1px solid #2A4A22;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
      text-decoration: none; cursor: pointer; transition: transform 0.15s, border-color 0.15s;
      box-sizing: border-box;
    }
    .game-card:hover { transform: translateY(-4px); border-color: #4DB349; }
    .game-card h2 { color: #d4f5c8; margin: 0.5rem 0 0; font-size: 1.3rem; }
    .game-card p { color: #7AAF72; font-size: 0.88rem; margin: 0; text-align: center; }
    .icon-row { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; height: 40px; }
    .disc { width: 26px; height: 26px; border-radius: 50%; display: inline-block; }
    .disc.red    { background: #C0392B; box-shadow: 0 0 10px #C0392Baa; }
    .disc.yellow { background: #E8B84B; box-shadow: 0 0 10px #E8B84Baa; }
    .disc.blue   { background: #4361EE; box-shadow: 0 0 10px #4361EEaa; }
    .ship-icon {
      width: 64px; height: 28px; border-radius: 4px;
      background: linear-gradient(180deg, #2d6a4f, #1b3a5c);
      box-shadow: 0 0 10px #2d6a4faa;
    }
  `],
})
export class HomeComponent {}
