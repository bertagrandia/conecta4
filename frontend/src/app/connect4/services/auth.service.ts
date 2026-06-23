import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Token } from '../models';

const TOKEN_KEY = 'connect4_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = environment.apiUrl;
  readonly isLoggedIn = signal(this.hasValidToken());

  constructor(private http: HttpClient, private router: Router) {}

  guestLogin(username: string): Observable<Token> {
    return this.http
      .post<Token>(`${this.api}/connect4/auth/guest`, { username })
      .pipe(tap((t) => this.saveToken(t.access_token)));
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/connect4/name']);
  }

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  getUsername(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        // Just clear the stale session here: navigating away is the
        // caller's responsibility (e.g. a route guard, which needs to
        // redirect with its own returnUrl). Triggering navigation as a
        // side effect of this check raced with the guard's own redirect
        // and silently dropped the returnUrl query param.
        this.clearSession();
        return null;
      }
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.isLoggedIn.set(false);
  }

  private saveToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
    this.isLoggedIn.set(true);
  }

  private hasValidToken(): boolean {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
