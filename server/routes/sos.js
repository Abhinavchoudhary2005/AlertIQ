import dotenv from "dotenv";
dotenv.config();

import express from "express";
import User from "../models/User.js";
import twilio from "twilio";

const router = express.Router();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

router.post("/trigger", async (req, res) => {
  console.log("SOS API HIT");

  const { uid, location } = req.body;

  const user = await User.findOne({ uid });

  if (!user) {
    console.log("User not found");
    return res.status(404).json({ error: "User not found" });
  }

  const message = `🚨 SOS ALERT 🚨
User needs help!
https://maps.google.com/?q=${location.lat},${location.lng}`;

  const results = [];

  for (const contact of user.emergencyContacts) {
    try {
      const msg = await client.messages.create({
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

  res.json({ success: true, results });
});

export default router;
