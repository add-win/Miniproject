require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

const keyPath = process.env.FIREBASE_KEY_PATH || path.join(__dirname, "firebase-key.json");

if (!fs.existsSync(keyPath)) {
  console.error("\n❌ Missing Firebase service account key!");
  console.error(`   Expected at: ${keyPath}`);
  console.error("   → Download it from Firebase Console > Project Settings > Service Accounts");
  console.error("   → Save it as: backend/firebase-key.json\n");
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const messaging = admin.messaging();

let tokens = [];
let detections = [];

const detectionsFile = path.join(__dirname, "detections.json");
if (fs.existsSync(detectionsFile)) {
  try {
    detections = JSON.parse(fs.readFileSync(detectionsFile, "utf8"));
    console.log(`📂 Loaded ${detections.length} previous detections from file.`);
  } catch (e) {
    console.warn("⚠️  Could not parse detections.json, starting fresh.");
  }
}

app.post("/register", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "No token provided" });
  }

  if (!tokens.includes(token)) {
    tokens.push(token);
    console.log(`✅ New device registered. Total: ${tokens.length}`);
  } else {
    console.log("ℹ️  Token already registered.");
  }

  res.json({ message: "Device registered" });
});

app.post("/detect", async (req, res) => {
  const { animal, location, imageUrl = "" } = req.body;

  if (!animal || !location) {
    return res.status(400).json({ message: "Missing animal or location" });
  }

  const timestamp = new Date();
  const timeStr = timestamp.toLocaleString();

  const detection = {
    animal,
    location,
    imageUrl,
    time: timeStr,
    timestamp: timestamp.toISOString(),
    message: `⚠ ALERT: ${animal} detected at ${location}`,
  };

  detections.unshift(detection);
  fs.writeFileSync(detectionsFile, JSON.stringify(detections, null, 2));
  console.log(`\n🐾 Detection: ${animal} at ${location}`);
  try {
    await db.collection("alerts").add({
      animal,
      location,
      imageUrl,
      message: detection.message,
      timestamp: admin.firestore.Timestamp.fromDate(timestamp),
    });
    console.log("✅ Saved to Firestore");
  } catch (err) {
    console.error("⚠️  Firestore write failed:", err.message);
  }

  const validTokens = tokens.filter((t) => t);
  if (validTokens.length === 0) {
    console.log("⚠️  No registered devices — skipping FCM.");
    return res.json({ message: "Detection saved. No devices registered for FCM." });
  }

  const fcmMessage = {
    data: {
      title: "⚠️ Wild Animal Detected",
      body: `${animal} detected at ${location}`,
      animal,
      location,
      imageUrl,
      timestamp: timestamp.toISOString(),
    },
    tokens: validTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(fcmMessage);
    console.log(`📲 FCM: ${response.successCount}/${validTokens.length} sent`);

    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          console.log(`🗑  Removed stale token: ${validTokens[idx].slice(0, 20)}...`);
          tokens = tokens.filter((t) => t !== validTokens[idx]);
        }
      }
    });

    res.json({
      message: "Detection recorded and alert sent",
      fcmSent: response.successCount,
      firestoreSync: true,
    });
  } catch (err) {
    console.error("❌ FCM error:", err.message);
    res.status(500).json({ message: "Detection saved but FCM failed", error: err.message });
  }
});

app.get("/detections", (req, res) => {
  res.json(detections);
});

app.post("/reset", async (req, res) => {
  tokens = [];
  detections = [];

  fs.writeFileSync(detectionsFile, JSON.stringify([], null, 2));

  const detectionsDir = path.join(__dirname, "detections");
  if (fs.existsSync(detectionsDir)) {
    const files = fs.readdirSync(detectionsDir);
    for (const file of files) {
      if (file.endsWith(".jpg") || file.endsWith(".png")) {
        try {
          fs.unlinkSync(path.join(detectionsDir, file));
        } catch (e) {
          console.error("Could not delete file:", file);
        }
      }
    }
  }

  try {
    const snapshot = await db.collection("alerts").get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("🔥 Firestore collection cleared");
  } catch (err) {
    console.error("⚠️  Firestore wipe failed:", err.message);
  }

  console.log("🗑️ System reset triggered: tokens, logs, and images cleared.");
  res.json({ message: "System reset successfully" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "running",
    registeredDevices: tokens.length,
    totalDetections: detections.length,
    uptime: process.uptime().toFixed(0) + "s",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("\n🚀 WildGuard Backend running");
});

const pwaPath = path.join(__dirname, "..", "pwa");
if (fs.existsSync(pwaPath)) {
  app.use(express.static(pwaPath));
  console.log("🌐 Serving PWA from /pwa at http://localhost:" + (process.env.PORT || 5000));
}

app.use("/detections_images", express.static(path.join(__dirname, "detections")));
console.log("📸 Serving images at /detections_images");