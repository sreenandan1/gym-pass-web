import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
export const API = 'https://gym-pass-web.onrender.com/api';
export const authInterceptor: HttpInterceptorFn = (req, next) => { const t = localStorage.getItem('t'); return next(t ? req.clone({ setHeaders: { Authorization: 'Bearer ' + t } }) : req); };
@Injectable({ providedIn: 'root' })
export class Api {
  http = inject(HttpClient);
  user = signal<any>(JSON.parse(localStorage.getItem('u') || 'null'));
  get = (p: string, params?: any) => this.http.get<any>(API + p, { params });
  post = (p: string, b: any) => this.http.post<any>(API + p, b);
  put = (p: string, b: any) => this.http.put<any>(API + p, b);
  patch = (p: string, b: any) => this.http.patch<any>(API + p, b);
  delete = (p: string) => this.http.delete<any>(API + p);
  login(r: any) { localStorage.setItem('t', r.token); localStorage.setItem('u', JSON.stringify(r.user)); this.user.set(r.user); }
  logout() { localStorage.clear(); this.user.set(null); }
}

export const role = (...r: string[]): CanActivateFn => () => { const a = inject(Api), rt = inject(Router); return (a.user() && (!r.length || r.includes(a.user().role))) || rt.parseUrl('/login'); };
export const inr = (p: number) => '₹' + (p / 100).toLocaleString('en-IN');
