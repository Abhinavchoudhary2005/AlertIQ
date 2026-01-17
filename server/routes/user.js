import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.post("/save", async (req, res) => {
  const { uid, phone, name, emergencyPhone } = req.body;

  let user = await User.findOne({ uid });

  const newContact = { name, phone: emergencyPhone };

  if (!user) {
    user = new User({
      uid,
      phone,
      emergencyContacts: [newContact],
    });
  } else {
    user.emergencyContacts.push(newContact);
  }

  await user.save();
  res.json({ success: true });
});

router.get("/:uid", async (req, res) => {
  const user = await User.findOne({ uid: req.params.uid });
  res.json(user);
});

router.post("/save-route", async (req, res) => {
  const { uid, name, route } = req.body;

  const newRoute = {
    name,
    points: route,
  };

  const user = await User.findOneAndUpdate(
    { uid },
    { $push: { commuteRoutes: newRoute } },
    { new: true, upsert: true }
  );

  res.json({ success: true, routes: user.commuteRoutes });
});

router.get("/route/:uid", async (req, res) => {
  const user = await User.findOne({ uid: req.params.uid });
  res.json(user?.commuteRoutes || []);
});
export default router;
