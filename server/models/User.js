import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  name: String,
  phone: String,
});

const routePointSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
});

const commuteRouteSchema = new mongoose.Schema({
  name: String,
  points: [routePointSchema],
});

const userSchema = new mongoose.Schema({
  uid: String,
  phone: String,
  emergencyContacts: [contactSchema],
  commuteRoutes: [commuteRouteSchema],
});

export default mongoose.model("User", userSchema);
