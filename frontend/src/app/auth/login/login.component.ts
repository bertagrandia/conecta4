import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="logo">
          <span class="disc red"></span>
          <span class="title">Conecta 4</span>
          <span class="disc yellow"></span>
        </div>

        <h2>Iniciar sesión</h2>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Usuario</label>
            <input formControlName="username" type="text" placeholder="tu_usuario" autocomplete="username" />
            <span class="error" *ngIf="form.get('username')?.invalid && form.get('username')?.touched">
              Mínimo 3 caracteres
            </span>
          </div>

          <div class="field">
            <label>Contraseña</label>
            <input formControlName="password" type="password" placeholder="••••••" autocomplete="current-password" />
            <span class="error" *ngIf="form.get('password')?.invalid && form.get('password')?.touched">
              Mínimo 6 caracteres
            </span>
          </div>

          <span class="error api-error" *ngIf="apiError()">{{ apiError() }}</span>

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <p class="switch">¿No tienes cuenta? <a routerLink="/register">Regístrate</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0B1A08;
    }
    .auth-card {
      background: #152B10;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      border: 1px solid #2A4A22;
    }
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 1.5rem;
    }
    .disc {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-block;
    }
    .disc.red    { background: #C0392B; box-shadow: 0 0 12px #C0392Baa; }
    .disc.yellow { background: #E8B84B; box-shadow: 0 0 12px #E8B84Baa; }
    .title { color: #d4f5c8; font-size: 1.4rem; font-weight: 700; }
    h2 { color: #d4f5c8; text-align: center; margin-bottom: 1.5rem; font-weight: 600; }
    .field { margin-bottom: 1rem; }
    label { display: block; color: #7AAF72; font-size: 0.85rem; margin-bottom: 4px; }
    input {
      width: 100%;
      padding: 0.65rem 0.9rem;
      background: #0B1A08;
      border: 1px solid #2A4A22;
      border-radius: 8px;
      color: #d4f5c8;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #4DB349; }
    input::placeholder { color: #3d6b38; }
    .error { color: #C0392B; font-size: 0.78rem; margin-top: 3px; display: block; }
    .api-error { margin-bottom: 0.5rem; font-size: 0.88rem; }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #4DB349;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: background 0.2s, opacity 0.2s;
    }
    button:hover:not(:disabled) { background: #3D9939; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .switch { color: #7AAF72; text-align: center; margin-top: 1.2rem; font-size: 0.9rem; }
    .switch a { color: #4DB349; text-decoration: none; }
    .switch a:hover { text-decoration: underline; }
  `],
})
export class LoginComponent {
  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = signal(false);
  apiError = signal('');

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.apiError.set('');
    const { username, password } = this.form.value;
    this.auth.login(username!, password!).subscribe({
      next: () => this.router.navigate(['/lobby']),
      error: (e) => { this.apiError.set(e.error?.detail ?? 'Error al iniciar sesión'); this.loading.set(false); },
    });
  }
}
