import { Routes } from '@angular/router';
import { LoginComponent } from './features/login';
import { DashboardComponent } from './features/dashboard';
import { ReportDetailComponent } from './features/report-detail';
import { inject } from '@angular/core';
import { AuthService } from './core/auth.service';
import { Router } from '@angular/router';

const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.parseUrl('/login');
};

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'reports/:id', component: ReportDetailComponent, canActivate: [authGuard] },
];
