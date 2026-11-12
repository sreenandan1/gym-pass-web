require("dotenv").config();
const express = require("express"),
  cors = require("cors"),
  helmet = require("helmet"),
  rate = require("express-rate-limit"),
  path = require("path"),
  fs = require("fs"),
  multer = require("multer");
const jwt = require("jsonwebtoken"),
  bcrypt = require("bcryptjs"),
  crypto = require("crypto"),
  mongoose = require("mongoose"),
  Razorpay = require("razorpay");
const { User, Gym, Booking, Review } = require("./models");
const S = process.env.JWT_SECRET || "dev",
  rzp = process.env.RAZORPAY_KEY_ID
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;
const app = express();

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
  cors({ origin: process.env.CLIENT_URL || true }),
  express.json({ limit: "10mb" }),
  rate({ windowMs: 60000, limit: 120 }),
);

const storage = multer.diskStorage({
  destination: (q, file, cb) => cb(null, uploadDir),
  filename: (q, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (q, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});
const wrap = (f) => (q, r, n) =>
  f(q, r, n).catch((e) => r.status(400).json({ error: e.message }));
const auth =
  (...roles) =>
  (q, r, n) => {
    try {
      q.user = jwt.verify((q.headers.authorization || "").slice(7), S);
      if (roles.length && !roles.includes(q.user.role))
        return r.status(403).json({ error: "Forbidden" });
      n();
    } catch {
      r.status(401).json({ error: "Unauthorized" });
    }
  };
const api = express.Router();
app.use("/api", api);

// ---- Auth (phone + OTP & email + password) ----
const sendOtp = (phone, otp) => console.log(`[OTP] ${phone}: ${otp}`);
api.post(
  "/auth/otp",
  wrap(async (q, r) => {
    const phone = String(q.body.phone || "").trim();
    if (!phone) throw new Error("Phone number is required");
    const otp = String(crypto.randomInt(100000, 999999));
    await User.findOneAndUpdate(
      { phone },
      {
        otpHash: await bcrypt.hash(otp, 8),
        otpExp: Date.now() + 5 * 60000,
        ...(phone === process.env.ADMIN_PHONE && { role: "admin" }),
      },
      { upsert: true },
    );
    sendOtp(phone, otp);
    r.json({ ok: true });
  }),
);
api.post(
  "/auth/verify",
  wrap(async (q, r) => {
    const phone = String(q.body.phone || "").trim();
    const otp = String(q.body.otp !== undefined ? q.body.otp : "").trim();
    if (!phone || !otp) throw new Error("Phone and OTP are required");

    const u = await User.findOne({ phone });
    if (
      !u ||
      !u.otpExp ||
      u.otpExp < Date.now() ||
      !u.otpHash ||
      !(await bcrypt.compare(otp, u.otpHash))
    )
      throw new Error("Invalid OTP");
    if (q.body.asPartner && u.role === "customer") u.role = "partner";
    u.otpExp = null;
    if (q.body.name) u.name = q.body.name;
    await u.save();
    r.json({
      token: jwt.sign({ id: u.id, role: u.role }, S, { expiresIn: "30d" }),
      user: {
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
      },
    });
  }),
);
api.post(
  "/auth/login-password",
  wrap(async (q, r) => {
    const { email, phone, password } = q.body;
    const identifier = String(email || phone || "").trim();
    const pwd = String(password || "");
    if (!identifier || !pwd)
      throw new Error("Email/Phone and password are required");
    const u = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    });
    if (!u || !u.passwordHash)
      throw new Error("Invalid credentials or no password set for this account");
    const match = await bcrypt.compare(pwd, u.passwordHash);
    if (!match) throw new Error("Invalid password");
    r.json({
      token: jwt.sign({ id: u.id, role: u.role }, S, { expiresIn: "30d" }),
      user: {
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
      },
    });
  }),
);
api.post(
  "/auth/register-password",
  wrap(async (q, r) => {
    const { name, email, phone, password, asPartner } = q.body;
    if (!password || password.length < 6)
      throw new Error("Password must be at least 6 characters");
    if (!email && !phone) throw new Error("Email or phone is required");

    if (email) {
      const existingEmail = await User.findOne({
        email: email.trim().toLowerCase(),
      });
      if (existingEmail) throw new Error("Email already registered");
    }
    if (phone) {
      const existingPhone = await User.findOne({ phone: phone.trim() });
      if (existingPhone) throw new Error("Phone already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let role = asPartner ? "partner" : "customer";
    if (phone && phone === process.env.ADMIN_PHONE) role = "admin";

    const u = await User.create({
      name: name || (email ? email.split("@")[0] : "User"),
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone ? phone.trim() : undefined,
      passwordHash,
      role,
    });

    r.json({
      token: jwt.sign({ id: u.id, role: u.role }, S, { expiresIn: "30d" }),
      user: {
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
      },
    });
  }),
);

// ---- Gyms ----
api.get(
  "/gyms",
  wrap(async (q, r) => {
    const f = { status: "approved" },
      { city, maxPrice, amenity, q: s } = q.query;
    if (city) f.city = new RegExp(city, "i");
    if (maxPrice) f.pricePerDay = { $lte: +maxPrice };
    if (amenity) f.amenities = { $all: [].concat(amenity) };
    if (s) f.name = new RegExp(s, "i");
    r.json(
      await Gym.find(f)
        .select("-razorpayAccountId -commissionPct")
        .sort("-rating"),
    );
  }),
);
api.get(
  "/gyms/:id",
  wrap(async (q, r) =>
    r.json(
      await Gym.findById(q.params.id).select(
        "-razorpayAccountId -commissionPct",
      ),
    ),
  ),
);
api.get(
  "/gyms/:id/reviews",
  wrap(async (q, r) =>
    r.json(
      await Review.find({ gym: q.params.id })
        .populate("user", "name")
        .sort("-createdAt")
        .limit(30),
    ),
  ),
);
api.post(
  "/gyms/:id/reviews",
  auth(),
  wrap(async (q, r) => {
    const b = await Booking.findOne({
      user: q.user.id,
      gym: q.params.id,
      status: "checked_in",
    });
    if (!b) throw new Error("Visit this gym first");
    await Review.create({
      user: q.user.id,
      gym: q.params.id,
      rating: q.body.rating,
      comment: q.body.comment,
    });
    const g = await Gym.findById(q.params.id);
    g.rating = (g.rating * g.ratingCount + q.body.rating) / (g.ratingCount + 1);
    g.ratingCount++;
    await g.save();
    r.json(g);
  }),
);
api.get(
  "/partner/gym",
  auth("partner"),
  wrap(async (q, r) => r.json(await Gym.findOne({ owner: q.user.id }))),
);
api.put(
  "/partner/gym",
  auth("partner"),
  wrap(async (q, r) => {
    const {
      name,
      city,
      address,
      description,
      photos,
      videos,
      amenities,
      rules,
      openTime,
      closeTime,
      pricePerDay,
      pricePerHour,
      capacity,
    } = q.body;
    r.json(
      await Gym.findOneAndUpdate(
        { owner: q.user.id },
        {
          name,
          city,
          address,
          description,
          photos,
          videos,
          amenities,
          rules,
          openTime,
          closeTime,
          pricePerDay,
          pricePerHour,
          capacity,
        },
        { upsert: true, new: true },
      ),
    );
  }),
);

// ---- Bookings + Razorpay Route split (Live & Test mode) ----
api.post(
  "/bookings",
  auth(),
  wrap(async (q, r) => {
    const { gymId, date, type, slot } = q.body;
    const g = await Gym.findOne({ _id: gymId, status: "approved" });
    if (!g) throw new Error("Gym unavailable");
    if (date < new Date().toISOString().slice(0, 10))
      throw new Error("Past date");
    const taken = await Booking.countDocuments({
      gym: g.id,
      date,
      status: { $in: ["paid", "checked_in"] },
      ...(type === "hour" && { slot }),
    });
    if (taken >= g.capacity) throw new Error("Slot full");
    const amount = Math.round(
        (type === "hour" ? g.pricePerHour : g.pricePerDay) * 100,
      ),
      commission = Math.round((amount * g.commissionPct) / 100),
      payout = amount - commission;
    const b = await Booking.create({
      user: q.user.id,
      gym: g.id,
      date,
      type,
      slot,
      amount,
      commission,
      payout,
    });

    const isPlaceholderKey =
      !process.env.RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID.includes("xxx") ||
      process.env.RAZORPAY_KEY_ID === "test";

    let orderId = `order_test_${Date.now()}`;
    let isMock = isPlaceholderKey || !rzp;

    if (rzp && !isPlaceholderKey) {
      try {
        const orderOpts = {
          amount,
          currency: "INR",
          receipt: b.id,
          notes: { bookingId: b.id },
        };
        if (
          g.razorpayAccountId &&
          g.razorpayAccountId.startsWith("acc_") &&
          !g.razorpayAccountId.includes("XXXX")
        ) {
          orderOpts.transfers = [
            {
              account: g.razorpayAccountId,
              amount: payout,
              currency: "INR",
              notes: { gym: g.name },
              on_hold: 0,
            },
          ];
        }
        const order = await rzp.orders.create(orderOpts);
        orderId = order.id;
        isMock = false;
      } catch (err) {
        console.warn(
          "[Razorpay Test Warning]:",
          err.message,
          "-> Trying order without Route split...",
        );
        try {
          const simpleOrder = await rzp.orders.create({
            amount,
            currency: "INR",
            receipt: b.id,
            notes: { bookingId: b.id },
          });
          orderId = simpleOrder.id;
          isMock = false;
        } catch (innerErr) {
          console.warn("[Razorpay Test Mode]: Fallback to simulated test order.");
          isMock = true;
        }
      }
    }

    b.orderId = orderId;
    await b.save();
    r.json({
      bookingId: b.id,
      orderId,
      amount,
      key: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
      isMock,
    });
  }),
);
api.post(
  "/bookings/verify",
  auth(),
  wrap(async (q, r) => {
    const {
      razorpay_order_id: o,
      razorpay_payment_id: p,
      razorpay_signature: s,
    } = q.body;

    const b = await Booking.findOne({ orderId: o, user: q.user.id });
    if (!b) throw new Error("Booking not found");

    const isSimulated =
      !process.env.RAZORPAY_KEY_SECRET ||
      process.env.RAZORPAY_KEY_SECRET === "xxx" ||
      (o && o.startsWith("order_test_"));

    if (!isSimulated && s) {
      const exp = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${o}|${p}`)
        .digest("hex");
      if (exp !== s) throw new Error("Signature mismatch");
    }

    b.status = "paid";
    b.paymentId = p || `pay_test_${Date.now()}`;
    b.qrToken = jwt.sign({ b: b.id, g: String(b.gym) }, S, {
      expiresIn: "90d",
    });
    await b.save();
    r.json(b);
  }),
);
api.get(
  "/bookings/mine",
  auth(),
  wrap(async (q, r) =>
    r.json(
      await Booking.find({ user: q.user.id, status: { $ne: "created" } })
        .populate("gym", "name city address")
        .sort("-createdAt"),
    ),
  ),
);

// ---- Partner: scan / check-in / log / finance ----
api.post(
  "/partner/scan",
  auth("partner"),
  wrap(async (q, r) => {
    const gym = await Gym.findOne({ owner: q.user.id });
    const t = jwt.verify(q.body.token, S);
    if (t.g !== gym.id) throw new Error("Pass is for another gym");
    const b = await Booking.findById(t.b).populate("user", "name phone");
    if (!b || b.status === "cancelled") throw new Error("Invalid pass");
    if (b.status === "checked_in") throw new Error("Already used");
    if (b.date !== new Date().toISOString().slice(0, 10))
      throw new Error(`Valid only on ${b.date}`);
    r.json({
      id: b.id,
      name: b.user.name,
      phone: b.user.phone,
      type: b.type,
      slot: b.slot,
      date: b.date,
    });
  }),
);
api.post(
  "/partner/checkin/:id",
  auth("partner"),
  wrap(async (q, r) => {
    const gym = await Gym.findOne({ owner: q.user.id });
    const b = await Booking.findOneAndUpdate(
      { _id: q.params.id, gym: gym.id, status: "paid" },
      { status: "checked_in", checkedInAt: new Date() },
      { new: true },
    );
    if (!b) throw new Error("Cannot check in");
    r.json(b);
  }),
);
api.get(
  "/partner/visitors",
  auth("partner"),
  wrap(async (q, r) => {
    const gym = await Gym.findOne({ owner: q.user.id });
    r.json(
      await Booking.find({
        gym: gym.id,
        date: q.query.date || new Date().toISOString().slice(0, 10),
        status: { $in: ["paid", "checked_in"] },
      })
        .populate("user", "name phone")
        .sort("-createdAt"),
    );
  }),
);
api.get(
  "/partner/finance",
  auth("partner"),
  wrap(async (q, r) => {
    const gym = await Gym.findOne({ owner: q.user.id });
    const [t] = await Booking.aggregate([
      { $match: { gym: gym._id, status: { $in: ["paid", "checked_in"] } } },
      {
        $group: {
          _id: null,
          bookings: { $sum: 1 },
          gross: { $sum: "$amount" },
          commission: { $sum: "$commission" },
          net: { $sum: "$payout" },
        },
      },
    ]);
    r.json(t || { bookings: 0, gross: 0, commission: 0, net: 0 });
  }),
);

// ---- File Uploads (Images & Videos) ----
api.post(
  "/upload",
  auth("admin", "partner"),
  (q, r, next) => {
    upload.array("files", 10)(q, r, (err) => {
      if (err) return r.status(400).json({ error: err.message });
      next();
    });
  },
  wrap(async (q, r) => {
    if (!q.files || !q.files.length) throw new Error("No files uploaded");
    const host = q.get("host") || `localhost:${process.env.PORT || 4000}`;
    const protocol = q.protocol || "http";
    const results = q.files.map((f) => {
      const isVideo = f.mimetype.startsWith("video/");
      return {
        url: `${protocol}://${host}/uploads/${f.filename}`,
        path: `/uploads/${f.filename}`,
        mimetype: f.mimetype,
        type: isVideo ? "video" : "photo",
        name: f.originalname,
      };
    });
    r.json({ files: results });
  }),
);

// ---- Super admin ----
api.get(
  "/admin/gyms",
  auth("admin"),
  wrap(async (q, r) =>
    r.json(
      await Gym.find().populate("owner", "name phone email").sort("-createdAt"),
    ),
  ),
);
api.post(
  "/admin/gyms",
  auth("admin"),
  wrap(async (q, r) => {
    const {
      ownerName,
      ownerPhone,
      ownerEmail,
      ownerPassword,
      name,
      city,
      address,
      description,
      photos,
      videos,
      amenities,
      rules,
      openTime,
      closeTime,
      pricePerDay,
      pricePerHour,
      capacity,
      commissionPct,
      razorpayAccountId,
      bankAccount,
      status,
    } = q.body;
    if (!ownerPhone && !ownerEmail)
      throw new Error("Owner phone or email is required");

    const query = [];
    if (ownerPhone) query.push({ phone: ownerPhone });
    if (ownerEmail) query.push({ email: ownerEmail.trim().toLowerCase() });

    let owner = await User.findOne({ $or: query });
    const passwordHash = ownerPassword
      ? await bcrypt.hash(ownerPassword, 10)
      : undefined;

    if (!owner) {
      owner = await User.create({
        phone: ownerPhone || undefined,
        email: ownerEmail ? ownerEmail.trim().toLowerCase() : undefined,
        passwordHash,
        name: ownerName || "Gym Owner",
        role: "partner",
      });
    } else {
      if (owner.role === "customer") owner.role = "partner";
      if (ownerName) owner.name = ownerName;
      if (ownerEmail) owner.email = ownerEmail.trim().toLowerCase();
      if (ownerPhone) owner.phone = ownerPhone;
      if (passwordHash) owner.passwordHash = passwordHash;
      await owner.save();
    }
    const gym = await Gym.create({
      owner: owner._id,
      name,
      city,
      address,
      description,
      photos: Array.isArray(photos) ? photos : photos ? [photos] : [],
      videos: Array.isArray(videos) ? videos : videos ? [videos] : [],
      amenities: Array.isArray(amenities)
        ? amenities
        : amenities
          ? amenities.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      rules: Array.isArray(rules) ? rules : [],
      openTime: openTime || "06:00",
      closeTime: closeTime || "22:00",
      pricePerDay: Number(pricePerDay) || 0,
      pricePerHour: Number(pricePerHour) || 0,
      capacity: Number(capacity) || 30,
      commissionPct: commissionPct !== undefined ? Number(commissionPct) : 15,
      razorpayAccountId: razorpayAccountId || "",
      bankAccount: bankAccount || {},
      status: status || "approved",
    });
    r.json(await Gym.findById(gym._id).populate("owner", "name phone email"));
  }),
);
api.put(
  "/admin/gyms/:id",
  auth("admin"),
  wrap(async (q, r) => {
    const {
      ownerName,
      ownerPhone,
      ownerEmail,
      ownerPassword,
      name,
      city,
      address,
      description,
      photos,
      videos,
      amenities,
      rules,
      openTime,
      closeTime,
      pricePerDay,
      pricePerHour,
      capacity,
      commissionPct,
      razorpayAccountId,
      bankAccount,
      status,
    } = q.body;
    const gym = await Gym.findById(q.params.id);
    if (!gym) throw new Error("Gym not found");
    if (ownerName || ownerPhone || ownerEmail || ownerPassword) {
      const owner = await User.findById(gym.owner);
      if (owner) {
        if (ownerName) owner.name = ownerName;
        if (ownerPhone) owner.phone = ownerPhone;
        if (ownerEmail) owner.email = ownerEmail.trim().toLowerCase();
        if (ownerPassword)
          owner.passwordHash = await bcrypt.hash(ownerPassword, 10);
        await owner.save();
      }
    }
    if (name !== undefined) gym.name = name;
    if (city !== undefined) gym.city = city;
    if (address !== undefined) gym.address = address;
    if (description !== undefined) gym.description = description;
    if (photos !== undefined)
      gym.photos = Array.isArray(photos) ? photos : photos ? [photos] : [];
    if (videos !== undefined)
      gym.videos = Array.isArray(videos) ? videos : videos ? [videos] : [];
    if (amenities !== undefined)
      gym.amenities = Array.isArray(amenities)
        ? amenities
        : amenities
          ? amenities.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
    if (rules !== undefined) gym.rules = Array.isArray(rules) ? rules : [];
    if (openTime !== undefined) gym.openTime = openTime;
    if (closeTime !== undefined) gym.closeTime = closeTime;
    if (pricePerDay !== undefined) gym.pricePerDay = Number(pricePerDay);
    if (pricePerHour !== undefined) gym.pricePerHour = Number(pricePerHour);
    if (capacity !== undefined) gym.capacity = Number(capacity);
    if (commissionPct !== undefined) gym.commissionPct = Number(commissionPct);
    if (razorpayAccountId !== undefined)
      gym.razorpayAccountId = razorpayAccountId;
    if (bankAccount !== undefined) gym.bankAccount = bankAccount;
    if (status !== undefined) gym.status = status;
    await gym.save();
    r.json(await Gym.findById(gym._id).populate("owner", "name phone email"));
  }),
);
api.patch(
  "/admin/gyms/:id",
  auth("admin"),
  wrap(async (q, r) => {
    const { status, commissionPct, razorpayAccountId, bankAccount } = q.body;
    r.json(
      await Gym.findByIdAndUpdate(
        q.params.id,
        { status, commissionPct, razorpayAccountId, bankAccount },
        { new: true, omitUndefined: true },
      ),
    );
  }),
);
api.delete(
  "/admin/gyms/:id",
  auth("admin"),
  wrap(async (q, r) => {
    await Gym.findByIdAndDelete(q.params.id);
    r.json({ ok: true });
  }),
);
api.get(
  "/admin/stats",
  auth("admin"),
  wrap(async (q, r) => {
    const [t] = await Booking.aggregate([
      { $match: { status: { $in: ["paid", "checked_in"] } } },
      {
        $group: {
          _id: null,
          bookings: { $sum: 1 },
          gross: { $sum: "$amount" },
          commission: { $sum: "$commission" },
          payouts: { $sum: "$payout" },
        },
      },
    ]);

    // Daily booking aggregation (recent dates)
    const daily = await Booking.aggregate([
      { $match: { status: { $in: ["paid", "checked_in"] } } },
      {
        $group: {
          _id: "$date",
          bookings: { $sum: 1 },
          gross: { $sum: "$amount" },
          commission: { $sum: "$commission" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    // Gym-wise revenue and commission breakdown
    const gymStats = await Booking.aggregate([
      { $match: { status: { $in: ["paid", "checked_in"] } } },
      {
        $group: {
          _id: "$gym",
          bookings: { $sum: 1 },
          gross: { $sum: "$amount" },
          commission: { $sum: "$commission" },
          payout: { $sum: "$payout" },
        },
      },
      {
        $lookup: {
          from: "gyms",
          localField: "_id",
          foreignField: "_id",
          as: "gymInfo",
        },
      },
      { $unwind: { path: "$gymInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          gymId: "$_id",
          name: { $ifNull: ["$gymInfo.name", "Unknown Gym"] },
          city: "$gymInfo.city",
          bookings: 1,
          gross: 1,
          commission: 1,
          payout: 1,
        },
      },
      { $sort: { gross: -1 } },
    ]);

    r.json({
      ...(t || { bookings: 0, gross: 0, commission: 0, payouts: 0 }),
      gyms: await Gym.countDocuments({ status: "approved" }),
      pending: await Gym.countDocuments({ status: "pending" }),
      daily,
      gymStats,
    });
  }),
);
api.get(
  "/admin/settlements",
  auth("admin"),
  wrap(async (q, r) =>
    r.json(
      await Booking.find({ status: { $in: ["paid", "checked_in"] } })
        .populate("gym", "name")
        .sort("-createdAt")
        .limit(100),
    ),
  ),
);

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("\n❌ FATAL CONFIGURATION ERROR: MONGO_URI is missing!");
  console.error("👉 Please add the 'MONGO_URI' variable in your Render Dashboard -> Environment tab.");
  console.error("👉 Example: mongodb+srv://<user>:<password>@cluster0.mongodb.net/gympass?retryWrites=true&w=majority\n");
  process.exit(1);
}

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

mongoose
  .connect(mongoUri)
  .then((conn) => {
    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
    app.listen(process.env.PORT || 4000, () =>
      console.log("✅ API successfully running on port", process.env.PORT || 4000),
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
