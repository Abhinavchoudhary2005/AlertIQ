import * as Location from "expo-location";
import { Alert, Vibration } from "react-native";
import { auth } from "../config/firebase";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function triggerSOS() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const res = await fetch(`${API_URL}/sos/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        },
      }),
    });

    const data = await res.json();

    if (data?.results?.some((r: any) => r.status === "sent")) {
      Vibration.vibrate([300, 300, 300]);
      Alert.alert("✅ SOS Sent", "Your emergency contacts were notified.");
    } else {
      Alert.alert("❌ SOS Failed", "Message could not be delivered.");
    }
  } catch (err) {
    Alert.alert("❌ SOS Error", "Network or server error.");
    console.log("SOS Error:", err);
  }
}
