import dotenv from "dotenv";
dotenv.config();

import express from "express";
import User from "../models/User.js";
import twilio from "twilio";
import crypto from "crypto";

const router = express.Router();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// In-memory store for active sessions (use Redis in production)
const activeSessions = new Map();
// sessionId -> { uid, userName, userPhone, locations: [], activeViewers: 0, createdAt, ended: false }

// Generate unique session ID
function generateSessionId() {
  return `sos_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

// Trigger SOS - Create session and send SMS with tracking link
router.post("/trigger", async (req, res) => {
  console.log("SOS API HIT");

  const { uid, location } = req.body;

  try {
    const user = await User.findOne({ uid });

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    // Create tracking session
    const sessionId = generateSessionId();
    activeSessions.set(sessionId, {
      uid,
      userName: user.name || "User",
      userPhone: user.phone,
      locations: [
        {
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date().toISOString(),
        },
      ],
      activeViewers: 0,
      createdAt: new Date(),
      ended: false,
    });

    // Generate tracking link
    const trackingUrl = `${process.env.WEB_URL || "http://localhost:3000"}/track/${sessionId}`;

    const message = `🚨 EMERGENCY ALERT from ${user.name || "User"}!

Click to track live location:
${trackingUrl}

This link shows real-time location updates.`;

    const results = [];

    for (const contact of user.emergencyContacts) {
      try {
        await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE,
          to: contact.phone,
        });
        results.push({ phone: contact.phone, status: "sent" });
      } catch (err) {
        console.log("SMS Error:", err.message);
        results.push({ phone: contact.phone, status: "failed" });
      }
    }

    res.json({ success: true, sessionId, results });
  } catch (err) {
    console.error("SOS trigger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update location (only processed if viewers are active)
router.post("/update-location", async (req, res) => {
  const { sessionId, location, timestamp } = req.body;

  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.ended) {
    return res.json({ success: false, message: "Session already ended" });
  }

  // Only store location if someone is actively viewing
  if (session.activeViewers > 0) {
    session.locations.push({
      lat: location.lat,
      lng: location.lng,
      timestamp: timestamp || new Date().toISOString(),
    });

    // Keep only last 100 locations to save memory
    if (session.locations.length > 100) {
      session.locations = session.locations.slice(-100);
    }

    console.log(
      `Location updated for session ${sessionId}. Active viewers: ${session.activeViewers}`,
    );
  }

  res.json({
    success: true,
    viewersActive: session.activeViewers > 0,
    message:
      session.activeViewers > 0
        ? "Location stored"
        : "No active viewers, location not stored",
  });
});

// End session
router.post("/end-session", async (req, res) => {
  const { sessionId } = req.body;

  const session = activeSessions.get(sessionId);
  if (session) {
    session.ended = true;
    session.endedAt = new Date();
    console.log(`Session ${sessionId} ended by user`);
  }

  res.json({ success: true });
});

// Get session data (for tracking website)
router.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found or expired" });
  }

  res.json({
    userName: session.userName,
    locations: session.locations,
    ended: session.ended,
    createdAt: session.createdAt,
    endedAt: session.endedAt || null,
  });
});

// Server-Sent Events endpoint for live updates
router.get("/stream/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Increment active viewers
  session.activeViewers++;
  console.log(
    `Viewer connected to session ${sessionId}. Active viewers: ${session.activeViewers}`,
  );

  // Send initial data
  res.write(
    `data: ${JSON.stringify({
      type: "init",
      session: {
        userName: session.userName,
        locations: session.locations,
        ended: session.ended,
        createdAt: session.createdAt,
      },
    })}\n\n`,
  );

  let lastLocationIndex = session.locations.length;

  // Send updates every 2 seconds
  const interval = setInterval(() => {
    // Check for new locations
    if (session.locations.length > lastLocationIndex) {
      const newLocations = session.locations.slice(lastLocationIndex);
      newLocations.forEach((location) => {
        res.write(`data: ${JSON.stringify({ type: "update", location })}\n\n`);
      });
      lastLocationIndex = session.locations.length;
    }

    // Check if session ended
    if (session.ended) {
      res.write(
        `data: ${JSON.stringify({ type: "ended", endedAt: session.endedAt })}\n\n`,
      );
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(interval);
    session.activeViewers--;
    console.log(
      `Viewer disconnected from session ${sessionId}. Active viewers: ${session.activeViewers}`,
    );
  });
});

// Clean up old sessions (run every 5 minutes)
setInterval(
  () => {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of activeSessions.entries()) {
      const ageHours = (now - session.createdAt) / (1000 * 60 * 60);
      // Delete sessions older than 24 hours
      if (ageHours > 24) {
        activeSessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(
        `Cleaned up ${cleaned} old sessions. Active sessions: ${activeSessions.size}`,
      );
    }
  },
  5 * 60 * 1000,
);

export default router;
