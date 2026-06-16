import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'lobby', pathMatch: 'full' },
  {
    path: 'name',
    loadComponent: () =>
      import('./auth/name/name.component').then((m) => m.NameComponent),
  },
  {
    path: 'lobby',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./lobby/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'game/:code',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./game/game.component').then((m) => m.GameComponent),
  },
  { path: '**', redirectTo: 'lobby' },
];
