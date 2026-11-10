import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Api } from "../api";

declare const Razorpay: any;

@Component({
  imports: [FormsModule],
  template: `
    @if (g(); as g) {
      <div class="wrap">
        <div class="detail-grid">
          <!-- Main Content (Gym Details, Photos, Videos, Reviews) -->
          <div class="stack">
            <div
              style="height: clamp(200px, 42vw, 340px); border-radius: 20px; background: linear-gradient(135deg, rgba(124, 92, 255, 0.4), rgba(198, 255, 61, 0.25)), #14141c; background-size: cover; background-position: center;"
              [style.background-image]="g.photos?.[0] ? 'url(' + g.photos[0] + ')' : ''"
            ></div>

            <div>
              <h1 style="font-size: clamp(24px, 5vw, 36px);">{{ g.name }}</h1>
              <p class="mut" style="font-size: 14px; margin-top: 4px;">
                📍 {{ g.address }}, {{ g.city }} · 🕒 Open {{ g.openTime }}–{{ g.closeTime }}
              </p>
            </div>

            <p style="font-size: 15px; line-height: 1.6;">{{ g.description || 'Welcome to ' + g.name + '! Train with top equipment and expert support.' }}</p>

            <div>
              <h4 style="font-size: 14px; color: var(--mut); margin-bottom: 8px;">AMENITIES & FACILITIES</h4>
              <div>
                @for (a of g.amenities; track a) {
                  <span class="chip">{{ a }}</span>
                }
              </div>
            </div>

            <!-- Videos Section -->
            @if (g.videos?.length) {
              <div class="card stack">
                <h3>🎥 Gym Tour & Videos</h3>
                <div class="stack">
                  @for (v of g.videos; track v) {
                    <video [src]="v" controls style="width: 100%; border-radius: 12px; max-height: 380px; background: #000;"></video>
                  }
                </div>
              </div>
            }

            <!-- House Rules -->
            @if (g.rules?.length) {
              <div class="card">
                <h3>📋 House rules</h3>
                <ul class="mut" style="padding-left: 20px; margin-top: 8px; font-size: 14px;">
                  @for (x of g.rules; track x) {
                    <li style="margin-bottom: 4px;">{{ x }}</li>
                  }
                </ul>
              </div>
            }

            <!-- Reviews Section -->
            <div>
              <h3 style="margin-bottom: 12px;">Member Reviews</h3>
              <div class="stack">
                @for (v of reviews(); track v._id) {
                  <div class="card">
                    <div class="row sp" style="margin-bottom: 4px;">
                      <b>{{ v.user?.name || "Member" }}</b>
                      <span class="tag">★ {{ v.rating }}</span>
                    </div>
                    <p class="mut" style="font-size: 14px;">{{ v.comment }}</p>
                  </div>
                } @empty {
                  <p class="mut" style="font-size: 14px;">No reviews yet. Be the first to visit and review!</p>
                }
              </div>
            </div>
          </div>

          <!-- Sticky / Action Sidebar (Booking Form) -->
          <div>
            <div class="card stack" style="position: sticky; top: 80px;">
              <h3>Book Your Workout</h3>
              <p class="mut" style="font-size: 13px;">Instant access QR pass sent to your phone</p>

              <div>
                <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Select Date</label>
                <input type="date" [(ngModel)]="date" [min]="today" />
              </div>

              <div>
                <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Pass Type</label>
                <select [(ngModel)]="type">
                  <option value="day">Day pass — ₹{{ g.pricePerDay }}</option>
                  <option value="hour">Hourly slot — ₹{{ g.pricePerHour }}</option>
                </select>
              </div>

              @if (type === "hour") {
                <div>
                  <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Select Time Slot</label>
                  <input type="time" [(ngModel)]="slot" />
                </div>
              }

              <button
                class="btn"
                style="width: 100%; margin-top: 8px;"
                [disabled]="busy()"
                (click)="book()"
              >
                {{ busy() ? 'Processing...' : 'Pay & Get QR Pass' }}
              </button>

              @if (msg()) {
                <p style="color: var(--bad); font-size: 13px;">{{ msg() }}</p>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class GymDetail implements OnInit {
  api = inject(Api);
  r = inject(Router);
  route = inject(ActivatedRoute);

  g = signal<any>(null);
  reviews = signal<any[]>([]);
  busy = signal(false);
  msg = signal("");

  today = new Date().toISOString().slice(0, 10);
  date = this.today;
  type = "day";
  slot = "07:00";

  ngOnInit() {
    const id = this.route.snapshot.params["id"];
    this.api.get("/gyms/" + id).subscribe((g) => this.g.set(g));
    this.api.get(`/gyms/${id}/reviews`).subscribe((v) => this.reviews.set(v));
  }

  book() {
    if (!this.api.user()) return void this.r.navigate(["/login"]);
    this.busy.set(true);
    this.msg.set("");
    this.api
      .post("/bookings", {
        gymId: this.g()._id,
        date: this.date,
        type: this.type,
        slot: this.type === "hour" ? this.slot : undefined,
      })
      .subscribe({
        error: (e) => {
          this.msg.set(e.error?.error);
          this.busy.set(false);
        },
        next: (o) => {
          // If in simulated test mode or placeholder key
          if (
            o.isMock ||
            typeof Razorpay === "undefined" ||
            !o.key ||
            o.key.includes("xxx") ||
            o.key === "rzp_test_placeholder"
          ) {
            this.api
              .post("/bookings/verify", {
                razorpay_order_id: o.orderId,
                razorpay_payment_id: `pay_test_${Date.now()}`,
                razorpay_signature: "mock_test_signature",
              })
              .subscribe({
                next: () => this.r.navigate(["/tickets"]),
                error: (e) => {
                  this.msg.set(e.error?.error || "Test payment failed");
                  this.busy.set(false);
                },
              });
            return;
          }

          // Real Razorpay Test / Live Checkout
          try {
            const rzp = new Razorpay({
              key: o.key,
              amount: o.amount,
              currency: "INR",
              order_id: o.orderId,
              name: "FitPass",
              description: `${this.g().name} Pass`,
              theme: { color: "#c6ff3d" },
              prefill: {
                contact: this.api.user()?.phone || "",
                email: this.api.user()?.email || "",
              },
              modal: { ondismiss: () => this.busy.set(false) },
              handler: (res: any) =>
                this.api
                  .post("/bookings/verify", res)
                  .subscribe({
                    next: () => this.r.navigate(["/tickets"]),
                    error: (e) => {
                      this.msg.set(e.error?.error);
                      this.busy.set(false);
                    },
                  }),
            });
            rzp.on("payment.failed", (resp: any) => {
              this.msg.set(resp.error?.description || "Payment failed");
              this.busy.set(false);
            });
            rzp.open();
          } catch (err: any) {
            this.msg.set(err.message || "Failed to open payment gateway");
            this.busy.set(false);
          }
        },
      });
  }
}
