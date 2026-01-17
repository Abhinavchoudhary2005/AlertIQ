import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Alert, Vibration } from "react-native";
import { auth } from "../config/firebase";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const LOCATION_TASK_NAME = "sos-location-tracking";
const UPDATE_INTERVAL = 5000; // Send update every 5 seconds when being tracked

let trackingInterval: NodeJS.Timeout | number | null = null;
let isTracking = false;
let sessionId: string | null = null;

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Location tracking error:", error);
    return;
  }
  if (data && sessionId) {
    const { locations } = data;
    const location = locations[0];
    await sendLocationUpdate(location.coords.latitude, location.coords.longitude);
  }
});

// Send location update to server
async function sendLocationUpdate(lat: number, lng: number) {
  if (!sessionId) return;

  try {
    await fetch(`${API_URL}/sos/update-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        location: { lat, lng },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("Location update error:", err);
  }
}

// Start live location tracking
async function startLiveTracking(newSessionId: string) {
  if (isTracking) return;

  sessionId = newSessionId;

  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      Alert.alert("Permission Denied", "Location permission is required for SOS tracking.");
      return;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    // Start foreground tracking
    trackingInterval = setInterval(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        await sendLocationUpdate(
          location.coords.latitude,
          location.coords.longitude
        );
      } catch (err) {
        console.error("Tracking interval error:", err);
      }
    }, UPDATE_INTERVAL);

    // Start background tracking if permission granted
    if (backgroundStatus === "granted") {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: UPDATE_INTERVAL,
        distanceInterval: 10, // Update every 10 meters
        foregroundService: {
          notificationTitle: "SOS Active",
          notificationBody: "Live location tracking is active",
          notificationColor: "#FF0000",
        },
      });
    }

    isTracking = true;
  } catch (err) {
    console.error("Failed to start tracking:", err);
    Alert.alert("Tracking Error", "Could not start live location tracking.");
  }
}

// Stop live location tracking
export async function stopLiveTracking() {
  if (!isTracking || !sessionId) return;

  try {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }

    const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (hasTask) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Notify server that tracking has stopped
    await fetch(`${API_URL}/sos/end-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    isTracking = false;
    sessionId = null;
    Alert.alert("✅ Tracking Stopped", "You are now safe.");
  } catch (err) {
    console.error("Stop tracking error:", err);
  }
}

// Check if currently tracking
export function isLiveTracking(): boolean {
  return isTracking;
}

// Trigger SOS
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

    if (data?.success && data?.sessionId) {
      Vibration.vibrate([300, 300, 300]);
      
      // Start live tracking with session ID
      await startLiveTracking(data.sessionId);
      
      Alert.alert(
        "✅ SOS Sent",
        "Emergency contacts notified with tracking link. Live location tracking started.",
        [
          {
            text: "I'm Safe Now",
            onPress: stopLiveTracking,
            style: "cancel",
          },
        ]
      );
    } else {
      Alert.alert("❌ SOS Failed", "Message could not be delivered.");
    }
  } catch (err) {
    Alert.alert("❌ SOS Error", "Network or server error.");
    console.log("SOS Error:", err);
  }
}