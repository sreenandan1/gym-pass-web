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

        <div>
          <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Amenities (comma separated)</label>
          <input [(ngModel)]="amen" placeholder="AC, Trainer, Shower, Parking" />
        </div>

        <!-- Photos Upload & URL Management -->
        <div class="stack" style="background: #0d0d14; border: 1px solid var(--line); border-radius: 14px; padding: 14px;">
          <div class="row sp" style="gap: 8px;">
            <div>
              <label style="font-weight: 600; font-size: 13px; color: var(--a);">📸 Gym Photos</label>
              <p class="mut" style="font-size: 11px;">Upload real photos from your device or paste image URLs</p>
            </div>
            <button type="button" class="btn" style="padding: 6px 14px; font-size: 12px; min-height: 36px;" (click)="photoInput.click()" [disabled]="uploading()">
              {{ uploading() ? 'Uploading...' : '📁 Upload Photos' }}
            </button>
            <input #photoInput type="file" multiple accept="image/*" style="display:none" (change)="onFilesSelected($event)" />
          </div>

          <div class="row" style="gap: 8px;">
            <input [(ngModel)]="photoUrlInput" placeholder="Paste image URL (https://...)" (keydown.enter)="addPhotoByUrl()" style="flex: 1; min-height: 38px; padding: 8px 12px; font-size: 13px;" />
            <button type="button" class="btn ghost" style="padding: 6px 14px; font-size: 12px; min-height: 38px;" (click)="addPhotoByUrl()">+ Add URL</button>
          </div>

          @if (uploadedPhotos().length) {
            <div>
              <span class="mut" style="font-size: 11px; display: block; margin-bottom: 6px;">Photos ({{ uploadedPhotos().length }})</span>
              <div class="row" style="gap: 10px; flex-wrap: wrap;">
                @for (p of uploadedPhotos(); track p; let idx = $index) {
                  <div style="position: relative; width: 88px; height: 68px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); background: #000;">
                    <img [src]="p" style="width: 100%; height: 100%; object-fit: cover;" />
                    <button type="button" (click)="removePhoto(idx)"
                            title="Remove photo"
                            style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.8); color: #fff; border: 0; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;">✕</button>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div style="border: 1px dashed var(--line); border-radius: 10px; padding: 14px; text-align: center; cursor: pointer;" (click)="photoInput.click()">
              <p class="mut" style="font-size: 12px;">No photos added yet. Tap "Upload Photos" or paste an image URL above.</p>
            </div>
          }
        </div>

        <!-- Videos Upload & URL Management -->
        <div class="stack" style="background: #0d0d14; border: 1px solid var(--line); border-radius: 14px; padding: 14px;">
          <div class="row sp" style="gap: 8px;">
            <div>
              <label style="font-weight: 600; font-size: 13px; color: var(--a);">🎥 Gym Videos & Virtual Tour</label>
              <p class="mut" style="font-size: 11px;">Upload MP4/video clips from device or paste video URLs</p>
            </div>
            <button type="button" class="btn" style="padding: 6px 14px; font-size: 12px; min-height: 36px;" (click)="videoInput.click()" [disabled]="uploading()">
              {{ uploading() ? 'Uploading...' : '📁 Upload Videos' }}
            </button>
            <input #videoInput type="file" multiple accept="video/*" style="display:none" (change)="onFilesSelected($event)" />
          </div>

          <div class="row" style="gap: 8px;">
            <input [(ngModel)]="videoUrlInput" placeholder="Paste video URL (https://...)" (keydown.enter)="addVideoByUrl()" style="flex: 1; min-height: 38px; padding: 8px 12px; font-size: 13px;" />
            <button type="button" class="btn ghost" style="padding: 6px 14px; font-size: 12px; min-height: 38px;" (click)="addVideoByUrl()">+ Add URL</button>
          </div>

          @if (uploadedVideos().length) {
            <div>
              <span class="mut" style="font-size: 11px; display: block; margin-bottom: 6px;">Videos ({{ uploadedVideos().length }})</span>
              <div class="row" style="gap: 10px; flex-wrap: wrap;">
                @for (v of uploadedVideos(); track v; let idx = $index) {
                  <div style="position: relative; width: 140px; height: 86px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); background: #000;">
                    <video [src]="v" controls style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <button type="button" (click)="removeVideo(idx)"
                            title="Remove video"
                            style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.85); color: #fff; border: 0; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; z-index: 2;">✕</button>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div style="border: 1px dashed var(--line); border-radius: 10px; padding: 14px; text-align: center; cursor: pointer;" (click)="videoInput.click()">
              <p class="mut" style="font-size: 12px;">No videos added yet. Tap "Upload Videos" or paste a video URL above.</p>
            </div>
          }
        </div>

        @if (uploading()) {
          <p style="color: var(--a); font-size: 12px; font-weight: 600;">⏳ Uploading media file(s), please wait...</p>
        }
        @if (mediaError()) {
          <p style="color: var(--bad); font-size: 12px; font-weight: 600;">{{ mediaError() }}</p>
        }
        @if (profileSaved()) {
          <p style="color: var(--a); font-size: 12px; font-weight: 600;">Gym profile & media saved successfully! ✔</p>
        }

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

        <button class="btn" style="width: 100%; margin-top: 8px;" (click)="save()" [disabled]="uploading() || saving()">
          {{ saving() ? 'Saving Profile...' : 'Save Gym Profile' }}
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
  sc?: Html5Qrcode;

  // Media signals & state
  uploadedPhotos = signal<string[]>([]);
  uploadedVideos = signal<string[]>([]);
  photoUrlInput = '';
  videoUrlInput = '';
  uploading = signal<boolean>(false);
  saving = signal<boolean>(false);
  mediaError = signal<string>('');
  profileSaved = signal<boolean>(false);

  ngOnInit() {
    this.refresh();
    this.api.get('/partner/gym').subscribe((g) => {
      if (g) {
        this.gym = g;
        this.amen = (g.amenities || []).join(', ');
        this.uploadedPhotos.set([...(g.photos || [])]);
        this.uploadedVideos.set([...(g.videos || [])]);
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

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || !files.length) return;

    this.uploading.set(true);
    this.mediaError.set('');

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    this.api.post('/upload', formData).subscribe({
      next: (res: any) => {
        this.uploading.set(false);
        if (res.files && Array.isArray(res.files)) {
          const photos = [...this.uploadedPhotos()];
          const videos = [...this.uploadedVideos()];
          for (const f of res.files) {
            if (f.type === 'video') {
              videos.push(f.url);
            } else {
              photos.push(f.url);
            }
          }
          this.uploadedPhotos.set(photos);
          this.uploadedVideos.set(videos);
        }
        event.target.value = '';
      },
      error: (err: any) => {
        this.uploading.set(false);
        this.mediaError.set(err.error?.error || 'Failed to upload file(s)');
        event.target.value = '';
      },
    });
  }

  addPhotoByUrl() {
    const u = (this.photoUrlInput || '').trim();
    if (!u) return;
    this.uploadedPhotos.set([...this.uploadedPhotos(), u]);
    this.photoUrlInput = '';
  }

  addVideoByUrl() {
    const u = (this.videoUrlInput || '').trim();
    if (!u) return;
    this.uploadedVideos.set([...this.uploadedVideos(), u]);
    this.videoUrlInput = '';
  }

  removePhoto(idx: number) {
    const list = [...this.uploadedPhotos()];
    list.splice(idx, 1);
    this.uploadedPhotos.set(list);
  }

  removeVideo(idx: number) {
    const list = [...this.uploadedVideos()];
    list.splice(idx, 1);
    this.uploadedVideos.set(list);
  }

  save() {
    this.saving.set(true);
    this.profileSaved.set(false);
    this.mediaError.set('');

    this.api
      .put('/partner/gym', {
        ...this.gym,
        amenities: this.amen
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        photos: this.uploadedPhotos(),
        videos: this.uploadedVideos(),
      })
      .subscribe({
        next: (g) => {
          this.gym = g;
          this.saving.set(false);
          this.profileSaved.set(true);
          setTimeout(() => this.profileSaved.set(false), 4000);
        },
        error: (err) => {
          this.saving.set(false);
          this.mediaError.set(err.error?.error || 'Failed to save gym profile');
        },
      });
  }

  ngOnDestroy() {
    this.stop();
  }
}
