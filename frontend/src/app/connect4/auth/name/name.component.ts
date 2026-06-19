import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-name',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="logo">
          <span class="disc red"></span>
          <span class="title">Conecta 4</span>
          <span class="disc yellow"></span>
        </div>

        <h2>¿Cómo te llamas?</h2>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Nombre</label>
            <input formControlName="username" type="text" placeholder="Tu nombre" autocomplete="username" />
            <span class="error" *ngIf="form.get('username')?.invalid && form.get('username')?.touched">
              Indica un nombre (máx. 20 caracteres)
            </span>
          </div>

          <span class="error api-error" *ngIf="apiError()">{{ apiError() }}</span>

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Entrando...' : 'Jugar' }}
          </button>
        </form>
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
  `],
})
export class NameComponent {
  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]],
  });

  loading = signal(false);
  apiError = signal('');

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.apiError.set('');
    const username = this.form.value.username!.trim();
    this.auth.guestLogin(username).subscribe({
      next: () => this.router.navigate(['/connect4/lobby']),
      error: (e) => { this.apiError.set(e.error?.detail ?? 'Error al entrar'); this.loading.set(false); },
    });
  }
}
