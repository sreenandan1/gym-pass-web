import { Routes } from '@angular/router';
import { role } from './api';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/gyms').then(m => m.Gyms) },
  { path: 'gym/:id', loadComponent: () => import('./pages/gym-detail').then(m => m.GymDetail) },
  { path: 'login', loadComponent: () => import('./pages/login').then(m => m.Login) },
  { path: 'tickets', canActivate: [role()], loadComponent: () => import('./pages/tickets').then(m => m.Tickets) },
  { path: 'partner', canActivate: [role('partner')], loadComponent: () => import('./pages/partner').then(m => m.Partner) },
  { path: 'admin', canActivate: [role('admin')], loadComponent: () => import('./pages/admin').then(m => m.Admin) },
  { path: '**', redirectTo: '' }];
