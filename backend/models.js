const m = require("mongoose");
const { Schema, model } = m;
const ref = (n) => ({ type: Schema.Types.ObjectId, ref: n });
exports.User = model(
  "User",
  new Schema(
    {
      phone: { type: String, unique: true, sparse: true },
      email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
      },
      passwordHash: String,
      name: String,
      role: {
        type: String,
        enum: ["customer", "partner", "admin"],
        default: "customer",
      },
      otpHash: String,
      otpExp: Date,
    },
    { timestamps: true },
  ),
);
exports.Gym = model(
  "Gym",
  new Schema(
    {
      owner: ref("User"),
      name: String,
      city: String,
      address: String,
      description: String,
      photos: [String],
      videos: [String],
      amenities: [String],
      rules: [String],
      openTime: { type: String, default: "06:00" },
      closeTime: { type: String, default: "22:00" },
      pricePerDay: Number,
      pricePerHour: Number,
      capacity: { type: Number, default: 30 },
      commissionPct: { type: Number, default: 15 },
      razorpayAccountId: String,
      bankAccount: {
        accountNumber: String,
        ifsc: String,
        bankName: String,
        beneficiaryName: String,
        upiId: String,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "suspended"],
        default: "pending",
      },
      rating: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);
exports.Booking = model(
  "Booking",
  new Schema(
    {
      user: ref("User"),
      gym: ref("Gym"),
      date: String,
      type: { type: String, enum: ["day", "hour"] },
      slot: String,
      amount: Number,
      commission: Number,
      payout: Number,
      status: {
        type: String,
        enum: ["created", "paid", "checked_in", "cancelled"],
        default: "created",
      },
      orderId: String,
      paymentId: String,
      qrToken: String,
      checkedInAt: Date,
    },
    { timestamps: true },
  ),
);
exports.Review = model(
  "Review",
  new Schema(
    { user: ref("User"), gym: ref("Gym"), rating: Number, comment: String },
    { timestamps: true },
  ),
);
