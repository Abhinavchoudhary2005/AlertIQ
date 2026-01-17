// app/services/journeyService.ts
import { auth } from "../config/firebase";

const API_BASE_URL = process.env.EXPO_PUBLIC_JOURNEY_API;

interface Coordinate {
  lat: number;
  lng: number;
}

interface LiveLocationPayload {
  uid: string;
  lat: number;
  lng: number;
  accel: number[];
  gyro: number[];
  timestamp: number;
}

/**
 * Initialize journey - sends route to ML model for training
 */
export const initJourneyAPI = async (coords: Coordinate[]) => {
  const user = auth.currentUser;
  if (!user || !coords) {
    throw new Error("User not authenticated or no route data");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/init-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user.uid, route: coords }),
    });

    if (!response.ok) {
      throw new Error("Failed to initialize route");
    }

    const result = await response.json();
    console.log("✅ ML Model Initialized:", result);
    return result;
  } catch (err) {
    console.error("❌ Init Journey Error:", err);
    throw err;
  }
};

/**
 * Send live location data to backend for safety check
 */
export const sendLiveLocationAPI = async (payload: LiveLocationPayload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/live-point`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const json = JSON.parse(text);

    return json;
  } catch (err) {
    console.error("❌ Live Point API Error:", err);
    throw err;
  }
};
