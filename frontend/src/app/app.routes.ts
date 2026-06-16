import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'lobby', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register.component').then((m) => m.RegisterComponent),
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
