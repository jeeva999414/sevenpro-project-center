// server.js – 7 Pro backend (orders + contact messages + email)
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const app = express();

const PORT = process.env.PORT || 4000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sevenpro";

// --- Middleware ---
app.use(bodyParser.json());

const allowedOrigins = [
  "http://localhost:4000",
  "http://127.0.0.1:4000",
  "null", // when loading index.html from file://
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  })
);

// --- MongoDB connection ---
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB:", MONGO_URI);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// --- Schemas & models ---
const orderSchema = new mongoose.Schema(
  {
    studentName: String,
    instituteName: String,
    mobile: String,
    email: String,
    city: String,
    educationLevel: String,

    projectSerial: String,
    orderedFromIdea: String, // "yes" / "no"

    projectTitle: String,
    projectDomain: String,
    projectConcept: String,
    projectDescription: String,

    deadline: String,
    budget: String,
  },
  { timestamps: true }
);

const contactSchema = new mongoose.Schema(
  {
    name: String,
    mobile: String,
    message: String,
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
const ContactMessage = mongoose.model("ContactMessage", contactSchema);

// --- Email (Nodemailer) ---
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail", // or another SMTP service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  console.log("✉️  Email transport configured. Order emails will be sent.");
} else {
  console.log(
    "⚠️  EMAIL_USER or EMAIL_PASS not set – order confirmation emails are disabled."
  );
}

// helper: send confirmation mail to student (non-blocking)
async function sendOrderEmail(orderDoc) {
  if (!transporter) return;
  if (!orderDoc.email) return;

  const to = orderDoc.email;
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const subject = "7 Pro – Your project request has been received";
  const text = `Hi ${orderDoc.studentName || "Student"},

Thank you for submitting your project request to 7 Pro – Student Project Center.

We will contact you within 1 hour on your mobile number: ${orderDoc.mobile || "-"}

Project details:
Title : ${orderDoc.projectTitle || "-"}
Domain: ${orderDoc.projectDomain || "-"}
Serial: ${orderDoc.projectSerial || "-"}

If you made any mistake in the details, just reply to this email or send us a WhatsApp message.

Regards,
7 Pro – Student Project Center
`;

  try {
    await transporter.sendMail({ from, to, subject, text });
    console.log("✅ Order confirmation email sent to:", to);
  } catch (err) {
    console.warn("⚠️  Failed to send confirmation email:", err.message);
  }
}

// --- Routes ---
app.get("/", (req, res) => {
  res.json({ ok: true, message: "7 Pro backend running." });
});

// Create order
app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};

    // Basic validation
    if (!body.studentName || !body.mobile || !body.projectTitle) {
      return res.status(400).json({
        ok: false,
        message: "studentName, mobile and projectTitle are required.",
      });
    }

    const order = await Order.create({
      studentName: body.studentName,
      instituteName: body.instituteName,
      mobile: body.mobile,
      email: body.email,
      city: body.city,
      educationLevel: body.educationLevel,
      projectSerial: body.projectSerial,
      orderedFromIdea: body.orderedFromIdea,
      projectTitle: body.projectTitle,
      projectDomain: body.projectDomain,
      projectConcept: body.projectConcept,
      projectDescription: body.projectDescription,
      deadline: body.deadline,
      budget: body.budget,
    });

    // Try to send email (non-blocking)
    sendOrderEmail(order).catch(() => {});

    res.json({
      ok: true,
      message:
        "Order saved. Our team will contact the student within an hour.",
      order,
    });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({
      ok: false,
      message: "Server error while saving order.",
    });
  }
});

// Get all orders (for host panel)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, orders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// Save contact message
app.post("/api/messages", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.mobile || !body.message) {
      return res.status(400).json({
        ok: false,
        message: "name, mobile and message are required.",
      });
    }

    const msg = await ContactMessage.create({
      name: body.name,
      mobile: body.mobile,
      message: body.message,
    });

    res.json({
      ok: true,
      message: "Message saved in database.",
      data: msg,
    });
  } catch (err) {
    console.error("Error saving contact message:", err);
    res.status(500).json({
      ok: false,
      message: "Server error while saving message.",
    });
  }
});

// (Optional) Get messages – for host if you want later
app.get("/api/messages", async (req, res) => {
  try {
    const msgs = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ ok: true, messages: msgs });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 7 Pro backend listening at http://localhost:${PORT}`);
});
