import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import QRCode from 'qrcode';
import { Api } from '../api';

@Component({
  imports: [DatePipe],
  template: `
    <div class="wrap">
      <div style="margin-bottom: 24px;">
        <h1>My Passes</h1>
        <p class="mut" style="font-size: 14px; margin-top: 4px;">Show the QR pass at the gym counter to check in</p>
      </div>

      <div class="grid">
        @for (b of items(); track b._id) {
          <div class="card stack" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
            <div class="row sp" style="width: 100%; border-bottom: 1px solid var(--line); padding-bottom: 10px;">
              <b style="font-size: 16px;">{{ b.gym?.name }}</b>
              <span class="tag" [class.warn]="b.status === 'checked_in'">
                {{ b.status === 'paid' ? 'Ready to use' : 'Checked in' }}
              </span>
            </div>

            @if (qr()[b._id]) {
              <div style="padding: 12px 0;">
                <img
                  [src]="qr()[b._id]"
                  style="width: 200px; max-width: 100%; border-radius: 16px; background: #fff; padding: 10px; display: block; margin: auto;"
                  [style.opacity]="b.status === 'paid' ? 1 : 0.35"
                  alt="QR Code"
                />
              </div>
            }

            <div style="border-top: 1px solid var(--line); padding-top: 10px; width: 100%;">
              <p style="font-weight: 600; font-size: 14px;">{{ b.date | date: 'fullDate' }}</p>
              <p class="mut" style="font-size: 13px; margin-top: 2px;">
                {{ b.type === 'hour' ? 'Slot: ' + b.slot : 'Valid all day' }}
              </p>
            </div>
          </div>
        } @empty {
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
            <p class="mut">You don't have any gym passes yet.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class Tickets implements OnInit {
  api = inject(Api);
  items = signal<any[]>([]);
  qr = signal<Record<string, string>>({});

  ngOnInit() {
    this.api.get('/bookings/mine').subscribe(async (list) => {
      this.items.set(list);
      const m: any = {};
      for (const b of list) {
        if (b.qrToken) {
          m[b._id] = await QRCode.toDataURL(b.qrToken, { margin: 1, width: 440 });
        }
      }
      this.qr.set(m);
    });
  }
}
