import { Routes } from '@angular/router';
import { authGuard } from './connect4/guards/auth.guard';
import { nicknameGuard } from './battleship/guards/nickname.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'connect4',
    children: [
      { path: '', redirectTo: 'lobby', pathMatch: 'full' },
      {
        path: 'name',
        loadComponent: () =>
          import('./connect4/auth/name/name.component').then((m) => m.NameComponent),
      },
      {
        path: 'lobby',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./connect4/lobby/lobby.component').then((m) => m.LobbyComponent),
      },
      {
        path: 'game/:code',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./connect4/game/game.component').then((m) => m.GameComponent),
      },
      { path: '**', redirectTo: 'lobby' },
    ],
  },
  {
    path: 'battleship',
    children: [
      { path: '', redirectTo: 'lobby', pathMatch: 'full' },
      {
        path: 'lobby',
        loadComponent: () =>
          import('./battleship/lobby/lobby.component').then((m) => m.LobbyComponent),
      },
      {
        path: 'game/:code',
        canActivate: [nicknameGuard],
        loadComponent: () =>
          import('./battleship/game/game.component').then((m) => m.GameComponent),
      },
      { path: '**', redirectTo: 'lobby' },
    ],
  },
  { path: '**', redirectTo: '' },
];
