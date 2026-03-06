import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private userSignal = signal<User | null>(null);
  private tokenSignal = signal<string | null>(null);

  user = computed(() => this.userSignal());
  isAuthenticated = computed(() => !!this.userSignal());

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      if (savedUser && savedToken) {
        this.userSignal.set(JSON.parse(savedUser));
        this.tokenSignal.set(savedToken);
      }
    }
  }

  login(credentials: Record<string, string>) {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', credentials).pipe(
      tap(res => this.setSession(res))
    );
  }

  register(data: Record<string, string>) {
    return this.http.post<{ token: string; user: User }>('/api/auth/register', data).pipe(
      tap(res => this.setSession(res))
    );
  }

  logout() {
    this.userSignal.set(null);
    this.tokenSignal.set(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  private setSession(res: { token: string; user: User }) {
    this.userSignal.set(res.user);
    this.tokenSignal.set(res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    localStorage.setItem('token', res.token);
  }

  getToken() {
    return this.tokenSignal();
  }
}
