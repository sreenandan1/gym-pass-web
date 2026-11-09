import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { Api } from './api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header style="position:sticky;top:0;z-index:50;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);background:rgba(10,10,15,0.88);border-bottom:1px solid var(--line);">
      <div style="max-width:1120px;margin:auto;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">
        <a routerLink="/" style="display:flex;align-items:center;gap:6px;">
          <h2 style="font-size:22px;letter-spacing:-0.03em;">Fit<span style="color:var(--a)">Pass</span></h2>
        </a>
        <nav style="display:flex;align-items:center;gap:8px;">
          @if (api.user(); as u) {
            @if (u.role === 'customer') { <a routerLink="/tickets" class="mut" style="font-size:13px;font-weight:600;padding:6px 8px;">My passes</a> }
            @if (u.role === 'partner') { <a routerLink="/partner" class="mut" style="font-size:13px;font-weight:600;padding:6px 8px;">Partner</a> }
            @if (u.role === 'admin') { <a routerLink="/admin" class="mut" style="font-size:13px;font-weight:600;padding:6px 8px;">Admin</a> }
            <button class="btn ghost" style="padding:6px 12px;font-size:12px;min-height:34px;" (click)="api.logout(); r.navigate(['/'])">Logout</button>
          } @else {
            <a routerLink="/login" class="btn" style="padding:8px 16px;font-size:13px;min-height:36px;">Sign in</a>
          }
        </nav>
      </div>
    </header>
    <router-outlet />
  `,
})
export class App {
  api = inject(Api);
  r = inject(Router);
}
