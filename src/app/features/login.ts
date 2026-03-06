import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div class="text-center mb-8">
          <div class="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <i class="fas fa-microphone-alt text-white text-2xl"></i>
          </div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">VoxReport AI</h1>
          <p class="text-slate-500 mt-2">Connectez-vous pour gérer vos réunions</p>
        </div>

        <form (submit)="onSubmit()" class="space-y-6">
          @if (isRegister()) {
            <div>
              <label for="name" class="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
              <input type="text" id="name" [(ngModel)]="name" name="name" required
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all">
            </div>
          }
          
          <div>
            <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" id="email" [(ngModel)]="email" name="email" required
              class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all">
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <input type="password" id="password" [(ngModel)]="password" name="password" required
              class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all">
          </div>

          @if (error()) {
            <div class="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {{ error() }}
            </div>
          }

          <button type="submit" [disabled]="loading()"
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50">
            {{ loading() ? 'Chargement...' : (isRegister() ? 'Créer un compte' : 'Se connecter') }}
          </button>
        </form>

        <div class="mt-6 text-center">
          <button (click)="isRegister.set(!isRegister())" class="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
            {{ isRegister() ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire" }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  isRegister = signal(false);
  email = '';
  password = '';
  name = '';
  error = signal('');
  loading = signal(false);

  onSubmit() {
    this.loading.set(true);
    this.error.set('');
    
    const obs = this.isRegister() 
      ? this.auth.register({ email: this.email, password: this.password, name: this.name })
      : this.auth.login({ email: this.email, password: this.password });

    obs.subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Une erreur est survenue');
        this.loading.set(false);
      }
    });
  }
}
