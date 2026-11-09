import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { DecimalPipe } from "@angular/common";
import { Api } from "../api";

@Component({
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="wrap">
      <section style="padding: clamp(20px, 4vw, 44px) 0 clamp(16px, 3vw, 28px);">
        <h1 style="font-size: clamp(30px, 7vw, 60px); line-height: 1.08; letter-spacing: -0.03em;">
          Train anywhere.<br />
          <span style="color: var(--a);">Pay only for the day.</span>
        </h1>
        <p class="mut" style="margin-top: 12px; max-width: 520px; font-size: clamp(14px, 3.5vw, 16px);">
          Book a day pass or an hourly slot at top local gyms. No subscription. No lock-in.
        </p>
      </section>

      <!-- Search Filters -->
      <div class="card hero-search-card" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px;">
        <input
          style="flex: 2; min-width: 170px;"
          [(ngModel)]="q"
          placeholder="🔍 Search gym name..."
          (input)="load()"
        />
        <input
          style="flex: 1; min-width: 120px;"
          [(ngModel)]="city"
          placeholder="📍 City"
          (input)="load()"
        />
        <input
          style="flex: 1; min-width: 110px;"
          type="number"
          [(ngModel)]="maxPrice"
          placeholder="Max ₹/day"
          (input)="load()"
        />
        <select
          style="flex: 1; min-width: 120px;"
          [(ngModel)]="amenity"
          (change)="load()"
        >
          <option value="">Any amenity</option>
          <option>AC</option>
          <option>Trainer</option>
          <option>Shower</option>
          <option>Parking</option>
        </select>
      </div>

      <!-- Gyms Listing Grid -->
      <div class="grid">
        @for (g of gyms(); track g._id) {
          <a class="card hover" [routerLink]="['/gym', g._id]" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div
                style="height: 170px; border-radius: 14px; margin-bottom: 14px; background: linear-gradient(135deg, rgba(124, 92, 255, 0.35), rgba(198, 255, 61, 0.2)), #14141c; background-size: cover; background-position: center;"
                [style.background-image]="g.photos?.[0] ? 'url(' + g.photos[0] + ')' : ''"
              ></div>
              <div class="row sp" style="margin-bottom: 4px;">
                <h3>{{ g.name }}</h3>
                <span class="tag">★ {{ g.rating | number: "1.1-1" }}</span>
              </div>
              <p class="mut" style="font-size: 13px;">{{ g.city }} · Open {{ g.openTime }}–{{ g.closeTime }}</p>
              
              <div style="margin: 10px 0;">
                @for (a of g.amenities; track a) {
                  <span class="chip">{{ a }}</span>
                }
              </div>
            </div>

            <div class="row sp" style="border-top: 1px solid var(--line); padding-top: 12px; margin-top: 8px;">
              <span class="stat" style="font-size: 22px;">
                ₹{{ g.pricePerDay }}<small class="mut" style="font-size: 13px;"> /day</small>
              </span>
              <span class="mut" style="font-size: 13px;">₹{{ g.pricePerHour }}/hr</span>
            </div>
          </a>
        } @empty {
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
            <p class="mut">No gyms found matching your filters. Try clearing search terms.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class Gyms implements OnInit {
  api = inject(Api);
  gyms = signal<any[]>([]);
  q = "";
  city = "";
  maxPrice: number | null = null;
  amenity = "";

  ngOnInit() {
    this.load();
  }

  load() {
    const p: any = {};
    if (this.q) p.q = this.q;
    if (this.city) p.city = this.city;
    if (this.maxPrice) p.maxPrice = this.maxPrice;
    if (this.amenity) p.amenity = this.amenity;
    this.api.get("/gyms", p).subscribe((g) => this.gyms.set(g));
  }
}
