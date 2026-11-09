import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Api, inr } from "../api";

interface BankAccount {
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  beneficiaryName?: string;
  upiId?: string;
}

interface GymData {
  _id?: string;
  name?: string;
  city?: string;
  address?: string;
  description?: string;
  photos?: string[];
  videos?: string[];
  amenities?: string[];
  amenitiesInput?: string;
  openTime?: string;
  closeTime?: string;
  pricePerDay?: number;
  pricePerHour?: number;
  capacity?: number;
  commissionPct?: number;
  razorpayAccountId?: string;
  bankAccount?: BankAccount;
  status?: string;
  owner?: { _id?: string; name?: string; phone?: string; email?: string };
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

@Component({
  imports: [FormsModule],
  template: `
    <div class="wrap stack">
      <!-- Header with Action -->
      <div class="row sp" style="gap: 12px; align-items: flex-start;">
        <div>
          <h1>Super Admin Dashboard</h1>
          <p class="mut" style="font-size: 14px; margin-top: 4px;">
            Manage gyms, media, finance settings, and view platform analytics
          </p>
        </div>
        <button class="btn" (click)="openAddModal()" style="white-space: nowrap; flex-shrink: 0;">
          + Add New Gym
        </button>
      </div>

      <!-- Navigation Tabs (Mobile-Friendly Horizontal Scroll) -->
      <div class="tabs-scroll" style="border-bottom: 1px solid var(--line); padding-bottom: 10px;">
        <button class="btn" [class.ghost]="tab() !== 'analytics'" (click)="tab.set('analytics')">
          📊 Analytics & Graphs
        </button>
        <button class="btn" [class.ghost]="tab() !== 'gyms'" (click)="tab.set('gyms')">
          🏋️ Gyms & Finance
        </button>
        <button class="btn" [class.ghost]="tab() !== 'settlements'" (click)="tab.set('settlements')">
          💳 Settlements Log
        </button>
      </div>

      <!-- TAB 1: ANALYTICS & DASHBOARD -->
      @if (tab() === 'analytics') {
        <!-- KPI Metrics Grid (2 per row on phones) -->
        <div class="grid grid-kpi">
          @for (s of statsCards(); track s[0]) {
            <div class="card">
              <p class="mut" style="font-size: 13px;">{{ s[0] }}</p>
              <div class="stat">{{ s[1] }}</div>
            </div>
          }
        </div>

        <!-- Daily Bookings Visual Chart -->
        <div class="card stack">
          <div class="row sp">
            <div>
              <h3>Daily Bookings Trend</h3>
              <p class="mut" style="font-size: 13px;">Customer booking volume over recent days</p>
            </div>
            <span class="tag">Recent activity</span>
          </div>

          @if (dailyStats().length > 0) {
            <div class="table-responsive" style="padding-top: 18px; padding-bottom: 8px;">
              <div style="display:flex; align-items:flex-end; gap:14px; min-width:480px; height:180px; padding:0 8px 10px; border-bottom:2px solid var(--line);">
                @for (d of dailyStats(); track d._id) {
                  <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; min-width:38px;"
                       [title]="d._id + ': ' + d.bookings + ' bookings (Gross: ' + money(d.gross) + ')'">
                    <span style="font-size:11px; font-weight:700; color:var(--a); margin-bottom:6px;">{{ d.bookings }}</span>
                    <div [style.height.%]="getBarHeight(d.bookings)"
                         style="width:100%; max-width:32px; background:linear-gradient(180deg, var(--a), var(--a2)); border-radius:6px 6px 0 0; min-height:8px; transition: height .3s;"></div>
                    <span style="font-size:11px; color:var(--mut); margin-top:8px; white-space:nowrap;">{{ formatDay(d._id) }}</span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <p class="mut" style="padding: 24px; text-align: center;">No daily booking history recorded yet.</p>
          }
        </div>

        <!-- Gym-wise Revenue & Commission Breakdown -->
        <div class="card">
          <div style="margin-bottom: 12px;">
            <h3>Commission & Revenue per Gym</h3>
            <p class="mut" style="font-size: 13px;">Performance breakdown by partner gym</p>
          </div>
          <div class="table-responsive">
            <table>
              <tr>
                <th>Gym Name</th>
                <th>City</th>
                <th>Bookings</th>
                <th>Gross</th>
                <th>Commission</th>
                <th>Payout</th>
              </tr>
              @for (g of gymStats(); track g.gymId) {
                <tr>
                  <td><b>{{ g.name }}</b></td>
                  <td><span class="mut">{{ g.city || '—' }}</span></td>
                  <td>{{ g.bookings }}</td>
                  <td>{{ money(g.gross) }}</td>
                  <td style="color:var(--a); font-weight:700;">{{ money(g.commission) }}</td>
                  <td>{{ money(g.payout) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" style="text-align:center; padding: 24px;" class="mut">
                    No gym transactions recorded yet.
                  </td>
                </tr>
              }
            </table>
          </div>
        </div>
      }

      <!-- TAB 2: GYM MANAGEMENT & FINANCIAL SETTINGS -->
      @if (tab() === 'gyms') {
        <div class="card stack">
          <div class="row sp" style="gap: 12px;">
            <div>
              <h3>Registered Gyms & Accounts</h3>
              <p class="mut" style="font-size: 13px;">Configure commission %, bank payouts, and approve gyms</p>
            </div>
            <button class="btn" (click)="openAddModal()">+ Add New Gym</button>
          </div>

          <div class="table-responsive">
            <table>
              <tr>
                <th>Gym & Location</th>
                <th>Owner & Contact</th>
                <th>Pricing</th>
                <th>Commission %</th>
                <th>Payout / Bank Info</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
              @for (g of gyms(); track g._id) {
                <tr>
                  <td>
                    <div class="row" style="gap:10px; align-items:center; flex-wrap:nowrap;">
                      @if (g.photos?.[0]; as coverPhoto) {
                        <img [src]="coverPhoto" style="width:48px; height:48px; border-radius:8px; object-fit:cover; border:1px solid var(--line); flex-shrink:0;" />
                      }
                      <div style="min-width:140px;">
                        <b>{{ g.name || "—" }}</b><br />
                        <small class="mut">{{ g.city }} · {{ g.address || 'No address' }}</small><br />
                        <small class="mut">
                          📷 {{ g.photos?.length || 0 }} photos
                          @if (g.videos?.length; as vCount) { · 🎥 {{ vCount }} video(s) }
                        </small>
                      </div>
                    </div>
                  </td>
                  <td style="min-width:140px;">
                    <b>{{ g.owner?.name || "—" }}</b><br />
                    @if (g.owner?.phone; as oPhone) {
                      <small class="mut">📱 {{ oPhone }}</small><br />
                    }
                    @if (g.owner?.email; as oEmail) {
                      <small class="mut">✉️ {{ oEmail }}</small>
                    }
                  </td>
                  <td style="min-width:100px;">
                    ₹{{ g.pricePerDay || 0 }} /day<br />
                    <small class="mut">₹{{ g.pricePerHour || 0 }} /hr</small>
                  </td>
                  <td>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <input
                        type="number"
                        style="width:70px; padding:6px 8px; min-height:36px;"
                        [(ngModel)]="g.commissionPct"
                        (change)="quickSave(g)"
                      />
                      <small class="mut">%</small>
                    </div>
                  </td>
                  <td style="min-width:140px;">
                    @if (g.razorpayAccountId) {
                      <span class="chip" style="margin-bottom:4px;">RZP: {{ g.razorpayAccountId }}</span><br />
                    }
                    @if (g.bankAccount?.accountNumber) {
                      <small class="mut">
                        A/C: {{ g.bankAccount?.accountNumber }} ({{ g.bankAccount?.ifsc }})
                      </small>
                    } @else if (!g.razorpayAccountId) {
                      <small class="mut" style="color:var(--bad)">No payout info set</small>
                    }
                  </td>
                  <td>
                    <span class="tag" [class.warn]="g.status !== 'approved'">
                      {{ g.status }}
                    </span>
                  </td>
                  <td>
                    <div class="row" style="gap:6px; flex-wrap:nowrap;">
                      <button class="btn ghost" style="padding:6px 12px; font-size:12px; min-height:34px;" (click)="openEditModal(g)">
                        Edit
                      </button>
                      @if (g.status !== 'approved') {
                        <button class="btn" style="padding:6px 12px; font-size:12px; min-height:34px;" (click)="setStatus(g, 'approved')">
                          Approve
                        </button>
                      } @else {
                        <button class="btn ghost" style="padding:6px 12px; font-size:12px; min-height:34px;" (click)="setStatus(g, 'suspended')">
                          Suspend
                        </button>
                      }
                      <button class="btn bad" style="padding:6px 10px; font-size:12px; min-height:34px;" (click)="deleteGym(g)">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" style="text-align:center; padding: 24px;" class="mut">
                    No gyms added yet. Click "+ Add New Gym" to add the first one.
                  </td>
                </tr>
              }
            </table>
          </div>
        </div>
      }

      <!-- TAB 3: SETTLEMENTS LEDGER -->
      @if (tab() === 'settlements') {
        <div class="card stack">
          <div>
            <h3>Recent Settlements Ledger</h3>
            <p class="mut" style="font-size: 13px;">All verified bookings and payout distributions</p>
          </div>
          <div class="table-responsive">
            <table>
              <tr>
                <th>Gym</th>
                <th>Date</th>
                <th>Gross</th>
                <th>Commission</th>
                <th>Gym Payout</th>
              </tr>
              @for (b of settlements(); track b._id) {
                <tr>
                  <td><b>{{ b.gym?.name }}</b></td>
                  <td>{{ b.date }}</td>
                  <td>{{ money(b.amount) }}</td>
                  <td style="color:var(--a);">{{ money(b.commission) }}</td>
                  <td><b>{{ money(b.payout) }}</b></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" style="text-align:center; padding:24px;" class="mut">
                    No settlements recorded yet.
                  </td>
                </tr>
              }
            </table>
          </div>
        </div>
      }

      <!-- MODAL: ADD / EDIT GYM & OWNER (FULL MOBILE RESPONSIVE) -->
      @if (showModal()) {
        <div class="modal-overlay">
          <div class="modal-box card stack">
            <div class="row sp" style="border-bottom:1px solid var(--line); padding-bottom:12px;">
              <h2>{{ isEditing() ? 'Edit Gym Details' : 'Add New Gym & Owner' }}</h2>
              <button class="btn ghost" style="padding:6px 12px; min-height:36px;" (click)="closeModal()">✕</button>
            </div>

            @if (modalError()) {
              <p style="color:var(--bad); font-weight:600; font-size:13px; background:rgba(255,92,122,0.1); border:1px solid rgba(255,92,122,0.25); border-radius:8px; padding:10px;">
                ⚠️ {{ modalError() }}
              </p>
            }

            <form (ngSubmit)="saveGym()" class="stack">
              <!-- Section 1: Owner Details -->
              <h3 style="color:var(--a); margin-top:8px;">1. Gym Owner Account Details</h3>
              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Owner Name *</label>
                  <input [(ngModel)]="currentGym.ownerName" name="ownerName" placeholder="e.g. Rahul Sharma" required />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Owner Mobile (for OTP login)</label>
                  <input [(ngModel)]="currentGym.ownerPhone" name="ownerPhone" placeholder="10-digit mobile" maxlength="10" />
                </div>
              </div>

              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Owner Email (for Email login)</label>
                  <input [(ngModel)]="currentGym.ownerEmail" name="ownerEmail" type="email" placeholder="owner@gym.com" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">
                    Owner Password {{ isEditing() ? '(Leave blank to keep)' : '(For password login)' }}
                  </label>
                  <input [(ngModel)]="currentGym.ownerPassword" name="ownerPassword" type="password" placeholder="Min 6 characters" />
                </div>
              </div>

              <!-- Section 2: Gym Details -->
              <h3 style="color:var(--a); margin-top:14px;">2. Gym Information & Media</h3>
              <div class="row row-mobile-stack">
                <div style="flex:2;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Gym Name *</label>
                  <input [(ngModel)]="currentGym.name" name="name" placeholder="e.g. Iron Paradise Gym" required />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">City *</label>
                  <input [(ngModel)]="currentGym.city" name="city" placeholder="e.g. Kochi" required />
                </div>
              </div>

              <div>
                <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Full Address</label>
                <input [(ngModel)]="currentGym.address" name="address" placeholder="Street, Area, Landmark" />
              </div>

              <div>
                <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Description</label>
                <textarea [(ngModel)]="currentGym.description" name="description" rows="2" placeholder="Brief description of the gym facilities"></textarea>
              </div>

              <div>
                <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Amenities (comma-separated)</label>
                <input [(ngModel)]="currentGym.amenitiesInput" name="amenities" placeholder="AC, Trainer, Shower, Parking, Sauna, Locker" />
              </div>

              <!-- Media Upload (Photos & Videos) -->
              <div class="stack" style="background:#0d0d14; border:1px solid var(--line); border-radius:14px; padding:14px;">
                <div class="row sp" style="gap:8px;">
                  <div>
                    <label style="font-weight:600; font-size:13px; color:var(--a);">📸 Gym Photos & 🎥 Videos</label>
                    <p class="mut" style="font-size:11px;">Upload real images and videos directly from device</p>
                  </div>
                  <button type="button" class="btn" style="padding:6px 14px; font-size:12px; min-height:36px;" (click)="fileInput.click()" [disabled]="uploading()">
                    {{ uploading() ? 'Uploading...' : '📁 Upload Files' }}
                  </button>
                  <input #fileInput type="file" multiple accept="image/*,video/*" style="display:none" (change)="onFilesSelected($event)" />
                </div>

                @if (uploading()) {
                  <p style="color:var(--a); font-size:12px; font-weight:600;">⏳ Uploading media files, please wait...</p>
                }

                @if (uploadedPhotos().length) {
                  <div>
                    <span class="mut" style="font-size:11px; display:block; margin-bottom:6px;">Photos ({{ uploadedPhotos().length }})</span>
                    <div class="row" style="gap:10px;">
                      @for (p of uploadedPhotos(); track p; let idx = $index) {
                        <div style="position:relative; width:80px; height:64px; border-radius:8px; overflow:hidden; border:1px solid var(--line); background:#000;">
                          <img [src]="p" style="width:100%; height:100%; object-fit:cover;" />
                          <button type="button" (click)="removePhoto(idx)"
                                  style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.8); color:#fff; border:0; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center;">✕</button>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (uploadedVideos().length) {
                  <div>
                    <span class="mut" style="font-size:11px; display:block; margin-bottom:6px;">Videos ({{ uploadedVideos().length }})</span>
                    <div class="row" style="gap:10px;">
                      @for (v of uploadedVideos(); track v; let idx = $index) {
                        <div style="position:relative; width:120px; height:70px; border-radius:8px; overflow:hidden; border:1px solid var(--line); background:#000;">
                          <video [src]="v" controls style="width:100%; height:100%; object-fit:cover;"></video>
                          <button type="button" (click)="removeVideo(idx)"
                                  style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.8); color:#fff; border:0; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; z-index:2;">✕</button>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (!uploadedPhotos().length && !uploadedVideos().length) {
                  <div style="border:1px dashed var(--line); border-radius:10px; padding:16px; text-align:center; cursor:pointer;" (click)="fileInput.click()">
                    <p class="mut" style="font-size:12px;">No images or videos uploaded. Tap "Upload Files" to choose photos/videos.</p>
                  </div>
                }
              </div>

              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Price per Day (₹) *</label>
                  <input type="number" [(ngModel)]="currentGym.pricePerDay" name="pricePerDay" placeholder="199" required />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Price per Hour (₹)</label>
                  <input type="number" [(ngModel)]="currentGym.pricePerHour" name="pricePerHour" placeholder="60" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Daily Capacity</label>
                  <input type="number" [(ngModel)]="currentGym.capacity" name="capacity" placeholder="30" />
                </div>
              </div>

              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Open Time</label>
                  <input type="time" [(ngModel)]="currentGym.openTime" name="openTime" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Close Time</label>
                  <input type="time" [(ngModel)]="currentGym.closeTime" name="closeTime" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Status</label>
                  <select [(ngModel)]="currentGym.status" name="status">
                    <option value="approved">Approved (Live)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <!-- Section 3: Financial & Payout Settings -->
              <h3 style="color:var(--a); margin-top:14px;">3. Financial & Bank Details</h3>
              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Commission Percentage (%) *</label>
                  <input type="number" [(ngModel)]="currentGym.commissionPct" name="commissionPct" placeholder="15" required />
                </div>
                <div style="flex:1.5;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Razorpay Route Account ID</label>
                  <input [(ngModel)]="currentGym.razorpayAccountId" name="razorpayAccountId" placeholder="acc_XXXXX" />
                </div>
              </div>

              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Bank Name</label>
                  <input [(ngModel)]="currentBank.bankName" name="bankName" placeholder="e.g. HDFC Bank" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Account Number</label>
                  <input [(ngModel)]="currentBank.accountNumber" name="accountNumber" placeholder="Bank Account No." />
                </div>
              </div>

              <div class="row row-mobile-stack">
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">IFSC Code</label>
                  <input [(ngModel)]="currentBank.ifsc" name="ifsc" placeholder="e.g. HDFC0001234" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">Beneficiary Name</label>
                  <input [(ngModel)]="currentBank.beneficiaryName" name="beneficiaryName" placeholder="Account Holder Name" />
                </div>
                <div style="flex:1;">
                  <label class="mut" style="font-size:12px; display:block; margin-bottom:4px;">UPI ID (Optional)</label>
                  <input [(ngModel)]="currentBank.upiId" name="upiId" placeholder="name@upi" />
                </div>
              </div>

              <div class="row sp" style="border-top:1px solid var(--line); padding-top:14px; margin-top:12px; gap:10px;">
                <button type="button" class="btn ghost" style="flex:1;" (click)="closeModal()">Cancel</button>
                <button type="submit" class="btn" style="flex:1.5;" [disabled]="saving() || uploading()">
                  {{ saving() ? 'Saving...' : (isEditing() ? 'Save Changes' : 'Create Gym & Owner') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class Admin implements OnInit {
  api = inject(Api);

  tab = signal<"analytics" | "gyms" | "settlements">("analytics");
  gyms = signal<GymData[]>([]);
  statsCards = signal<any[]>([]);
  dailyStats = signal<any[]>([]);
  gymStats = signal<any[]>([]);
  settlements = signal<any[]>([]);

  showModal = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  saving = signal<boolean>(false);
  uploading = signal<boolean>(false);
  modalError = signal<string>("");

  uploadedPhotos = signal<string[]>([]);
  uploadedVideos = signal<string[]>([]);

  currentGym: GymData = {};
  currentBank: BankAccount = {};
  money = inr;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.get("/admin/gyms").subscribe((g: GymData[]) => this.gyms.set(g));
    this.api.get("/admin/settlements").subscribe((s: any[]) => this.settlements.set(s));
    this.api.get("/admin/stats").subscribe((s: any) => {
      this.statsCards.set([
        ["Total Bookings", s.bookings || 0],
        ["Gross Volume", inr(s.gross || 0)],
        ["Platform Commission", inr(s.commission || 0)],
        ["Gym Payouts", inr(s.payouts || 0)],
        ["Live Gyms", s.gyms || 0],
        ["Pending Review", s.pending || 0],
      ]);
      this.dailyStats.set(s.daily || []);
      this.gymStats.set(s.gymStats || []);
    });
  }

  getBarHeight(bookings: number): number {
    const list = this.dailyStats();
    if (!list.length) return 10;
    const max = Math.max(...list.map((d) => d.bookings || 1));
    return Math.max(15, Math.round((bookings / max) * 100));
  }

  formatDay(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  }

  openAddModal() {
    this.isEditing.set(false);
    this.modalError.set("");
    this.uploadedPhotos.set([]);
    this.uploadedVideos.set([]);
    this.currentGym = {
      name: "",
      city: "",
      address: "",
      description: "",
      amenitiesInput: "Cardio, Weights, Locker",
      openTime: "06:00",
      closeTime: "22:00",
      pricePerDay: 199,
      pricePerHour: 60,
      capacity: 30,
      commissionPct: 15,
      razorpayAccountId: "",
      status: "approved",
      ownerName: "",
      ownerPhone: "",
      ownerEmail: "",
      ownerPassword: "",
    };
    this.currentBank = {
      accountNumber: "",
      ifsc: "",
      bankName: "",
      beneficiaryName: "",
      upiId: "",
    };
    this.showModal.set(true);
  }

  openEditModal(g: GymData) {
    this.isEditing.set(true);
    this.modalError.set("");
    this.uploadedPhotos.set([...(g.photos || [])]);
    this.uploadedVideos.set([...(g.videos || [])]);
    this.currentGym = {
      ...g,
      ownerName: g.owner?.name || "",
      ownerPhone: g.owner?.phone || "",
      ownerEmail: g.owner?.email || "",
      ownerPassword: "",
      amenitiesInput: (g.amenities || []).join(", "),
    };
    this.currentBank = {
      accountNumber: g.bankAccount?.accountNumber || "",
      ifsc: g.bankAccount?.ifsc || "",
      bankName: g.bankAccount?.bankName || "",
      beneficiaryName: g.bankAccount?.beneficiaryName || "",
      upiId: g.bankAccount?.upiId || "",
    };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || !files.length) return;

    this.uploading.set(true);
    this.modalError.set("");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    this.api.post("/upload", formData).subscribe({
      next: (res: any) => {
        this.uploading.set(false);
        if (res.files && Array.isArray(res.files)) {
          const photos = [...this.uploadedPhotos()];
          const videos = [...this.uploadedVideos()];
          for (const f of res.files) {
            if (f.type === "video") {
              videos.push(f.url);
            } else {
              photos.push(f.url);
            }
          }
          this.uploadedPhotos.set(photos);
          this.uploadedVideos.set(videos);
        }
        event.target.value = "";
      },
      error: (err: any) => {
        this.uploading.set(false);
        this.modalError.set(err.error?.error || "Failed to upload file(s)");
        event.target.value = "";
      },
    });
  }

  removePhoto(index: number) {
    this.uploadedPhotos.set(this.uploadedPhotos().filter((_, i) => i !== index));
  }

  removeVideo(index: number) {
    this.uploadedVideos.set(this.uploadedVideos().filter((_, i) => i !== index));
  }

  saveGym() {
    if (!this.currentGym.ownerPhone && !this.currentGym.ownerEmail) {
      this.modalError.set("Owner mobile phone or email is required");
      return;
    }
    if (!this.currentGym.name || !this.currentGym.city) {
      this.modalError.set("Gym name and city are required");
      return;
    }

    this.saving.set(true);
    this.modalError.set("");

    const payload = {
      ...this.currentGym,
      amenities: (this.currentGym.amenitiesInput || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      photos: this.uploadedPhotos(),
      videos: this.uploadedVideos(),
      bankAccount: this.currentBank,
    };

    if (this.isEditing() && this.currentGym._id) {
      this.api.put(`/admin/gyms/${this.currentGym._id}`, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.loadData();
        },
        error: (e: any) => {
          this.saving.set(false);
          this.modalError.set(e.error?.error || "Failed to update gym");
        },
      });
    } else {
      this.api.post("/admin/gyms", payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.loadData();
        },
        error: (e: any) => {
          this.saving.set(false);
          this.modalError.set(e.error?.error || "Failed to create gym");
        },
      });
    }
  }

  quickSave(g: GymData) {
    this.api
      .patch(`/admin/gyms/${g._id}`, {
        commissionPct: g.commissionPct,
        razorpayAccountId: g.razorpayAccountId,
      })
      .subscribe();
  }

  setStatus(g: GymData, status: string) {
    this.api
      .patch(`/admin/gyms/${g._id}`, {
        status,
        commissionPct: g.commissionPct,
        razorpayAccountId: g.razorpayAccountId,
      })
      .subscribe((updated: any) => {
        g.status = updated.status;
        this.loadData();
      });
  }

  deleteGym(g: GymData) {
    if (!confirm(`Are you sure you want to delete ${g.name || "this gym"}?`)) {
      return;
    }
    this.api.delete(`/admin/gyms/${g._id}`).subscribe({
      next: () => {
        this.gyms.set(this.gyms().filter((item) => item._id !== g._id));
        this.loadData();
      },
      error: (e: any) => alert(e.error?.error || "Failed to delete gym"),
    });
  }
}
