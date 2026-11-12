import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Api } from "../api";

@Component({
  imports: [FormsModule],
  template: `
    <div class="wrap" style="max-width: 460px; padding-top: clamp(20px, 6vw, 60px);">
      <div class="card stack">
        <div>
          <h1>Welcome 👋</h1>
          <p class="mut" style="font-size: 14px; margin-top: 4px;">Choose your preferred login method.</p>
        </div>

        <!-- Method Switcher (Default: OTP) -->
        <div class="row" style="background: #0d0d14; border: 1px solid var(--line); border-radius: 12px; padding: 4px; gap: 4px;">
          <button
            type="button"
            class="btn"
            style="flex: 1; padding: 8px 10px; font-size: 13px; min-height: 40px;"
            [class.ghost]="mode() !== 'otp'"
            (click)="switchMode('otp')"
          >
            📱 Phone & OTP
          </button>
          <button
            type="button"
            class="btn"
            style="flex: 1; padding: 8px 10px; font-size: 13px; min-height: 40px;"
            [class.ghost]="mode() !== 'password'"
            (click)="switchMode('password')"
          >
            ✉️ Email & Pass
          </button>
        </div>

        <!-- MODE 1: MOBILE OTP (DEFAULT) -->
        @if (mode() === 'otp') {
          <div>
            <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Mobile Phone Number</label>
            <input [(ngModel)]="phone" type="tel" placeholder="10-digit mobile number" maxlength="10" />
          </div>

          @if (sent()) {
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Enter Verification OTP</label>
              <input [(ngModel)]="otp" type="number" placeholder="6-digit OTP" />
            </div>
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Your Name (Optional)</label>
              <input [(ngModel)]="name" placeholder="Your full name" />
            </div>
            <label class="row mut" style="cursor: pointer; font-size: 13px;">
              <input type="checkbox" [(ngModel)]="partner" style="width: auto; min-height: 20px;" />
              I own a gym (partner account)
            </label>
            <button class="btn" style="width: 100%" (click)="verifyOtp()">
              Verify & Continue
            </button>
          } @else {
            <button class="btn" style="width: 100%" (click)="sendOtp()">
              Send OTP
            </button>
          }
        }

        <!-- MODE 2: EMAIL & PASSWORD -->
        @if (mode() === 'password') {
          @if (isRegistering()) {
            <!-- Sign Up Form -->
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Full Name</label>
              <input [(ngModel)]="name" placeholder="Your full name" />
            </div>
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Email Address</label>
              <input [(ngModel)]="email" type="email" placeholder="name@example.com" />
            </div>
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Mobile Phone (Optional)</label>
              <input [(ngModel)]="phone" type="tel" placeholder="10-digit mobile number" maxlength="10" />
            </div>
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Password</label>
              <input [(ngModel)]="password" type="password" placeholder="Create password (min 6 chars)" />
            </div>
            <label class="row mut" style="cursor: pointer; font-size: 13px;">
              <input type="checkbox" [(ngModel)]="partner" style="width: auto; min-height: 20px;" />
              I own a gym (partner account)
            </label>
            <button class="btn" style="width: 100%" (click)="registerPassword()">
              Create Account
            </button>
            <p class="mut" style="font-size: 13px; text-align: center; margin-top: 4px;">
              Already have an account?
              <a href="javascript:void(0)" style="color: var(--a); font-weight: 600;" (click)="isRegistering.set(false)">Sign in</a>
            </p>
          } @else {
            <!-- Sign In Form -->
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Email or Mobile</label>
              <input [(ngModel)]="email" placeholder="Email or 10-digit mobile" />
            </div>
            <div>
              <label class="mut" style="font-size: 12px; display: block; margin-bottom: 4px;">Password</label>
              <input [(ngModel)]="password" type="password" placeholder="Password" />
            </div>
            <button class="btn" style="width: 100%" (click)="loginPassword()">
              Sign In
            </button>
            <p class="mut" style="font-size: 13px; text-align: center; margin-top: 4px;">
              Don't have an account?
              <a href="javascript:void(0)" style="color: var(--a); font-weight: 600;" (click)="isRegistering.set(true)">Create one</a>
            </p>
          }
        }

        <!-- Quick Super Admin Login Access -->
        <div style="border-top: 1px dashed var(--line); padding-top: 14px; margin-top: 8px; text-align: center;">
          <button
            type="button"
            class="btn ghost"
            style="width: 100%; font-size: 13px; min-height: 38px; border-color: rgba(198, 255, 61, 0.4); color: var(--a);"
            (click)="fillSuperAdmin()"
          >
            👑 One-Click Super Admin Login
          </button>
          <small class="mut" style="font-size: 11px; display: block; margin-top: 4px;">
            superadmin&#64;gmail.com · superadmin&#64;123
          </small>
        </div>

        @if (err()) {
          <p style="color: var(--bad); font-size: 13px; background: rgba(255, 92, 122, 0.1); border: 1px solid rgba(255, 92, 122, 0.2); border-radius: 8px; padding: 10px;">
            ⚠️ {{ err() }}
          </p>
        }
      </div>
    </div>
  `,
})
export class Login {
  api = inject(Api);
  r = inject(Router);

  mode = signal<"otp" | "password">("otp");
  isRegistering = signal<boolean>(false);
  sent = signal(false);
  err = signal("");

  phone = "";
  otp = "";
  name = "";
  email = "";
  password = "";
  partner = false;

  switchMode(m: "otp" | "password") {
    this.mode.set(m);
    this.err.set("");
  }

  sendOtp() {
    if (!this.phone) {
      this.err.set("Please enter your mobile number");
      return;
    }
    this.err.set("");
    this.api.post("/auth/otp", { phone: this.phone }).subscribe({
      next: () => this.sent.set(true),
      error: (e: any) => this.err.set(e.error?.error || "Failed to send OTP"),
    });
  }

  verifyOtp() {
    this.err.set("");
    this.api
      .post("/auth/verify", {
        phone: this.phone,
        otp: this.otp,
        name: this.name,
        asPartner: this.partner,
      })
      .subscribe({
        next: (res) => this.handleSuccess(res),
        error: (e: any) => this.err.set(e.error?.error || "Invalid OTP"),
      });
  }

  loginPassword() {
    if (!this.email || !this.password) {
      this.err.set("Please enter email/phone and password");
      return;
    }
    this.err.set("");
    this.api
      .post("/auth/login-password", {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => this.handleSuccess(res),
        error: (e: any) => this.err.set(e.error?.error || "Invalid credentials"),
      });
  }

  registerPassword() {
    if (!this.email && !this.phone) {
      this.err.set("Email or mobile number is required");
      return;
    }
    if (!this.password || this.password.length < 6) {
      this.err.set("Password must be at least 6 characters");
      return;
    }
    this.err.set("");
    this.api
      .post("/auth/register-password", {
        name: this.name,
        email: this.email,
        phone: this.phone,
        password: this.password,
        asPartner: this.partner,
      })
      .subscribe({
        next: (res) => this.handleSuccess(res),
        error: (e: any) => this.err.set(e.error?.error || "Registration failed"),
      });
  }

  fillSuperAdmin() {
    this.mode.set("password");
    this.isRegistering.set(false);
    this.email = "superadmin@gmail.com";
    this.password = "superadmin@123";
    this.err.set("");
    this.loginPassword();
  }

  private handleSuccess(res: any) {
    this.api.login(res);
    this.r.navigate([
      res.user.role === "admin"
        ? "/admin"
        : res.user.role === "partner"
          ? "/partner"
          : "/",
    ]);
  }
}
