import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
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

        <h2>Crear cuenta</h2>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Usuario</label>
            <input formControlName="username" type="text" placeholder="tu_usuario" autocomplete="username" />
            <span class="error" *ngIf="form.get('username')?.invalid && form.get('username')?.touched">
              Entre 3 y 20 caracteres
            </span>
          </div>

          <div class="field">
            <label>Contraseña</label>
            <input formControlName="password" type="password" placeholder="••••••" autocomplete="new-password" />
            <span class="error" *ngIf="form.get('password')?.invalid && form.get('password')?.touched">
              Mínimo 6 caracteres
            </span>
          </div>

          <div class="field">
            <label>Confirmar contraseña</label>
            <input formControlName="confirm" type="password" placeholder="••••••" autocomplete="new-password" />
            <span class="error" *ngIf="form.get('confirm')?.touched && form.errors?.['mismatch']">
              Las contraseñas no coinciden
            </span>
          </div>

          <span class="error api-error" *ngIf="apiError()">{{ apiError() }}</span>

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Creando cuenta...' : 'Registrarse' }}
          </button>
        </form>

        <p class="switch">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0D1B2A;
    }
    .auth-card {
      background: #1B2A3B;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
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
    .disc.red { background: #E63946; box-shadow: 0 0 12px #E63946aa; }
    .disc.yellow { background: #FFD166; box-shadow: 0 0 12px #FFD166aa; }
    .title { color: #fff; font-size: 1.4rem; font-weight: 700; }
    h2 { color: #fff; text-align: center; margin-bottom: 1.5rem; font-weight: 600; }
    .field { margin-bottom: 1rem; }
    label { display: block; color: #8aa3bc; font-size: 0.85rem; margin-bottom: 4px; }
    input {
      width: 100%;
      padding: 0.65rem 0.9rem;
      background: #0D1B2A;
      border: 1px solid #2a3d52;
      border-radius: 8px;
      color: #fff;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #4a9eff; }
    .error { color: #E63946; font-size: 0.78rem; margin-top: 3px; display: block; }
    .api-error { margin-bottom: 0.5rem; font-size: 0.88rem; }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #4a9eff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: background 0.2s, opacity 0.2s;
    }
    button:hover:not(:disabled) { background: #3a8fee; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .switch { color: #8aa3bc; text-align: center; margin-top: 1.2rem; font-size: 0.9rem; }
    .switch a { color: #4a9eff; text-decoration: none; }
    .switch a:hover { text-decoration: underline; }
  `],
})
export class RegisterComponent {
  form = this.fb.group(
    {
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', Validators.required],
    },
    {
      validators: (g) =>
        g.get('password')?.value === g.get('confirm')?.value ? null : { mismatch: true },
    },
  );

  loading = signal(false);
  apiError = signal('');

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.apiError.set('');
    const { username, password } = this.form.value;
    this.auth.register(username!, password!).subscribe({
      next: () => this.router.navigate(['/lobby']),
      error: (e) => {
        this.apiError.set(e.error?.detail ?? 'Error al registrar');
        this.loading.set(false);
      },
    });
  }
}
