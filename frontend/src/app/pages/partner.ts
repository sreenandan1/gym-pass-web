import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { Api, inr } from '../api';

@Component({
  imports: [FormsModule],
  template: `
    <div class="wrap stack">
      <div>
        <h1>Partner Dashboard</h1>
        <p class="mut" style="font-size: 14px; margin-top: 4px;">Check in guests, track daily visits, and update your gym profile</p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-kpi">
        @for (s of stats(); track s[0]) {
          <div class="card">
            <p class="mut" style="font-size: 13px;">{{ s[0] }}</p>
            <div class="stat">{{ s[1] }}</div>
          </div>
        }
      </div>

      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));">
        <!-- Scan Guest QR Card -->
        <div class="card stack">
          <h3>Scan Guest QR Pass</h3>
          <p class="mut" style="font-size: 13px;">Use camera to scan customer's FitPass QR ticket</p>
          <div id="reader" style="border-radius: 14px; overflow: hidden; background: #000; min-height: 200px;"></div>
          <button class="btn" (click)="scanning() ? stop() : start()">
            {{ scanning() ? '🛑 Stop Camera' : '📷 Open Camera to Scan' }}
          </button>

          @if (found(); as f) {
            <div class="card" style="border-color: var(--a); background: rgba(198, 255, 61, 0.05); padding: 14px;">
              <b style="font-size: 16px;">{{ f.name || f.phone }}</b>
              <p class="mut" style="font-size: 13px; margin: 4px 0 10px;">
                📱 {{ f.phone }} · {{ f.type }} pass ({{ f.slot || 'All day' }})
              </p>
              <button class="btn" style="width: 100%;" (click)="confirm(f.id)">
                Confirm Check-in
              </button>
            </div>
          }

          @if (msg()) {
            <p [style.color]="ok() ? 'var(--a)' : 'var(--bad)'" style="font-size: 13px; font-weight: 600;">
              {{ msg() }}
            </p>
          }
        </div>

        <!-- Today's Visitors Table -->
        <div class="card stack">
          <h3>Today's Visitors</h3>
          <div class="table-responsive">
            <table>
              <tr>
                <th>Guest</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
              @for (v of visitors(); track v._id) {
                <tr>
                  <td><b>{{ v.user?.name || v.user?.phone }}</b></td>
                  <td>{{ v.type }}</td>
                  <td>
                    <span class="tag" [class.warn]="v.status === 'paid'">
                      {{ v.status === 'checked_in' ? 'Checked in' : 'Pending' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="mut" style="text-align: center; padding: 24px;">No visitors checked in yet today.</td>
                </tr>
              }
            </table>
          </div>
        </div>
      </div>

      <!-- Gym Profile Form -->
      <div class="card stack">
        <div class="row sp">
          <div>
            <h3>Gym Profile & Information</h3>
            <p class="mut" style="font-size: 13px;">Keep your gym pricing, timings, and details up to date</p>
          </div>
          @if (gym.status) {
            <span class="tag" [class.warn]="gym.status !== 'approved'">
              Status: {{ gym.status }}
            </span>
          }
        </div>

        <div>
          <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Gym Name</label>
          <input [(ngModel)]="gym.name" placeholder="Gym name" />
        </div>

        <div class="row row-mobile-stack">
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">City</label>
            <input [(ngModel)]="gym.city" placeholder="City" />
          </div>
          <div style="flex: 2;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Address</label>
            <input [(ngModel)]="gym.address" placeholder="Full address" />
          </div>
        </div>

        <div>
          <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Description</label>
          <textarea [(ngModel)]="gym.description" placeholder="Description of equipment, trainers..." rows="2"></textarea>
        </div>

        <div class="row row-mobile-stack">
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Amenities (comma separated)</label>
            <input [(ngModel)]="amen" placeholder="AC, Trainer, Shower, Parking" />
          </div>
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Photo URL</label>
            <input [(ngModel)]="photo" placeholder="https://..." />
          </div>
        </div>

        <div class="row row-mobile-stack">
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Price per Day (₹)</label>
            <input type="number" [(ngModel)]="gym.pricePerDay" placeholder="₹ per day" />
          </div>
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Price per Hour (₹)</label>
            <input type="number" [(ngModel)]="gym.pricePerHour" placeholder="₹ per hour" />
          </div>
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Daily Capacity</label>
            <input type="number" [(ngModel)]="gym.capacity" placeholder="Daily capacity" />
          </div>
        </div>

        <div class="row row-mobile-stack">
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Open Time</label>
            <input type="time" [(ngModel)]="gym.openTime" />
          </div>
          <div style="flex: 1;">
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Close Time</label>
            <input type="time" [(ngModel)]="gym.closeTime" />
          </div>
        </div>

        <button class="btn" style="width: 100%; margin-top: 8px;" (click)="save()">
          Save Gym Profile
        </button>
      </div>
    </div>
  `,
})
export class Partner implements OnInit, OnDestroy {
  api = inject(Api);
  stats = signal<any[]>([]);
  visitors = signal<any[]>([]);
  found = signal<any>(null);
  msg = signal('');
  ok = signal(false);
  scanning = signal(false);

  gym: any = {};
  amen = '';
  photo = '';
  sc?: Html5Qrcode;

  ngOnInit() {
    this.refresh();
    this.api.get('/partner/gym').subscribe((g) => {
      if (g) {
        this.gym = g;
        this.amen = (g.amenities || []).join(', ');
        this.photo = g.photos?.[0] || '';
      }
    });
  }

  refresh() {
    this.api.get('/partner/finance').subscribe((f) =>
      this.stats.set([
        ['Total Bookings', f.bookings || 0],
        ['Gross Volume', inr(f.gross || 0)],
        ['Commission Cut', inr(f.commission || 0)],
        ['Net Payout', inr(f.net || 0)],
      ]),
    );
    this.api.get('/partner/visitors').subscribe((v) => this.visitors.set(v));
  }

  async start() {
    this.sc = new Html5Qrcode('reader');
    this.scanning.set(true);
    await this.sc.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (t) => {
        this.stop();
        this.api.post('/partner/scan', { token: t }).subscribe({
          next: (f) => {
            this.found.set(f);
            this.msg.set('');
          },
          error: (e) => {
            this.ok.set(false);
            this.msg.set(e.error?.error);
          },
        });
      },
      () => {},
    );
  }

  async stop() {
    await this.sc?.stop().catch(() => {});
    this.scanning.set(false);
  }

  confirm(id: string) {
    this.api.post('/partner/checkin/' + id, {}).subscribe({
      next: () => {
        this.ok.set(true);
        this.msg.set('Checked in successfully ✔');
        this.found.set(null);
        this.refresh();
      },
      error: (e) => {
        this.ok.set(false);
        this.msg.set(e.error?.error);
      },
    });
  }

  save() {
    this.api
      .put('/partner/gym', {
        ...this.gym,
        amenities: this.amen
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        photos: this.photo ? [this.photo] : [],
      })
      .subscribe((g) => (this.gym = g));
  }

  ngOnDestroy() {
    this.stop();
  }
}
