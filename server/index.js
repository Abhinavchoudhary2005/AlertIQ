import express from "express";
import userRoutes from "./routes/user.js";
import sosRoutes from "./routes/sos.js";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Test route
app.get("/", (req, res) => {
  res.send("AlertIQ Backend Running ✅");
});
app.use("/api/user", userRoutes);
app.use("/api/sos", sosRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
