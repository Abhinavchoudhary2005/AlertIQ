// app/screens/ViewRoute.tsx
import { View, Text, TouchableOpacity, Alert, Vibration } from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Accelerometer, Gyroscope } from "expo-sensors";
import { auth } from "../../config/firebase";
import { triggerSOS } from "../../utils/sosTrigger";
import {
  initJourneyAPI,
  sendLiveLocationAPI,
} from "../../services/journeyService";
import {
  getDistanceFromLatLonInMeters,
  findNearestPointOnRoute,
  calculateProgress,
} from "../../utils/geoUtils";
import EmergencyAlert from "../../components/EmergencyAlert";
import CooldownBanner from "../../components/CooldownBanner";
import TrackingControls from "../../components/TrackingControls";

const RESPONSE_TIME = 10; // seconds
const ALERT_COOLDOWN = 1 * 60 * 1000; // 1 minute
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds
const API_CHECK_INTERVAL = 10000; // 10 seconds
const TRAVELED_THRESHOLD = 10; // meters
const DESTINATION_RADIUS = 20; // meters - how close to final point counts as "arrived"

interface Coordinate {
  lat: number;
  lng: number;
}

export default function ViewRoute() {
  const { route } = useLocalSearchParams();
  const coords: Coordinate[] = route ? JSON.parse(route as string) : null;

  console.log(
    "🗺️ ViewRoute loaded with coords:",
    coords?.length || 0,
    "points",
  );

  // State
  const [tracking, setTracking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false); // NEW: Loading state
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const currentLocationRef = useRef<any>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [responseTimer, setResponseTimer] = useState(RESPONSE_TIME);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [traveledPoints, setTraveledPoints] = useState<Set<number>>(new Set());
  const [userMovedMap, setUserMovedMap] = useState(false);
  const [furthestIndex, setFurthestIndex] = useState(0);

  // Refs
  const mapRef = useRef<MapView>(null);
  const accelRef = useRef([0, 0, 0]);
  const gyroRef = useRef([0, 0, 0]);
  const apiInterval = useRef<any>(null);
  const responseInterval = useRef<any>(null);
  const cooldownTimeout = useRef<any>(null);
  const cooldownTimerInterval = useRef<any>(null);
  const sosTriggered = useRef(false);
  const alertCooldown = useRef(false);
  const locationSubscription = useRef<any>(null);
  const isTrackingRef = useRef(false);
  const alertShownRef = useRef(false);

  useEffect(() => {
    console.log("🔄 Component mounted");
    return () => {
      console.log("🧹 Component unmounting - cleaning up");
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      clearInterval(apiInterval.current);
      clearInterval(responseInterval.current);
      clearTimeout(cooldownTimeout.current);
      clearInterval(cooldownTimerInterval.current);
    };
  }, []);

  /* ---------- START TRACKING ---------- */

  const startTracking = async () => {
    console.log("▶️ START TRACKING clicked");
    setIsInitializing(true); // Set loading state

    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("📍 Location permission status:", status);

      if (status !== "granted") {
        console.log("❌ Location permission denied");
        Alert.alert(
          "Permission Required",
          "Location permission is required to track your journey",
        );
        setIsInitializing(false);
        return;
      }

      // Check if location services are enabled
      const locationServicesEnabled = await Location.hasServicesEnabledAsync();
      console.log("📍 Location services enabled:", locationServicesEnabled);

      if (!locationServicesEnabled) {
        Alert.alert(
          "Location Services Disabled",
          "Please enable location services in your device settings to use journey tracking",
          [{ text: "OK" }],
        );
        setIsInitializing(false);
        return;
      }

      console.log("📍 Getting initial location...");
      const initialLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log("✅ Initial location:", initialLoc.coords);
      setCurrentLocation(initialLoc.coords);
      currentLocationRef.current = initialLoc.coords;

      if (mapRef.current) {
        console.log("🗺️ Centering map on user location");
        mapRef.current.animateToRegion(
          {
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000,
        );
      }

      console.log("🤖 Initializing ML model with route...");
      await initJourneyAPI(coords);
      console.log("✅ ML model initialized successfully");

      console.log("🔄 Resetting tracking states");
      setTracking(true);
      isTrackingRef.current = true;
      sosTriggered.current = false;
      alertCooldown.current = false;
      alertShownRef.current = false;
      setTraveledPoints(new Set());
      setFurthestIndex(0);
      setUserMovedMap(false);

      console.log("📱 Setting up accelerometer & gyroscope...");
      Accelerometer.setUpdateInterval(1000);
      Gyroscope.setUpdateInterval(1000);

      Accelerometer.addListener((d) => {
        accelRef.current = [d.x, d.y, d.z];
      });

      Gyroscope.addListener((d) => {
        gyroRef.current = [d.x, d.y, d.z];
      });

      console.log("⏱️ Starting location interval (every 3s)");
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 5,
        },
        (loc) => {
          if (!isTrackingRef.current) {
            console.log("⚠️ Location update received but tracking stopped");
            return;
          }

          console.log("✅ Location updated:", {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });

          setCurrentLocation(loc.coords);
          currentLocationRef.current = loc.coords;

          updateTraveledPoints(loc.coords);

          if (!userMovedMap && mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              500,
            );
          }
        },
      );

      console.log("✅ Location subscription active");

      console.log("⏱️ Starting API check interval (every 10s)");

      // First API call immediately
      setTimeout(async () => {
        if (!isTrackingRef.current) return;
        await performAPICheck(initialLoc.coords);
      }, 2000);

      apiInterval.current = setInterval(async () => {
        if (!isTrackingRef.current) return;

        const locToUse = currentLocationRef.current;
        console.log("📍 API interval - location from ref:", locToUse);

        if (!locToUse) {
          console.log("❌ No current location for API check");
          return;
        }
        await performAPICheck(locToUse);
      }, API_CHECK_INTERVAL);

      console.log("✅ Tracking started successfully!");
      Alert.alert("Tracking Started", "Journey tracking is now active");
    } catch (err) {
      console.error("❌ Failed to start tracking:", err);
      setTracking(false);
      Alert.alert("Error", "Failed to start tracking: " + err);
    } finally {
      setIsInitializing(false); // Always clear loading state
    }
  };

  /* ---------- PERFORM API CHECK ---------- */

  const performAPICheck = async (location: any) => {
    const user = auth.currentUser;
    console.log("👤 API CHECK - Current user:", user?.uid);

    if (!user) {
      console.log("❌ No user authenticated");
      return;
    }

    const payload = {
      uid: user.uid,
      lat: location.latitude,
      lng: location.longitude,
      accel: accelRef.current,
      gyro: gyroRef.current,
      timestamp: Date.now(),
    };

    console.log("📤 Sending payload to API:", payload);

    try {
      const response = await sendLiveLocationAPI(payload);
      console.log(
        "📥 API Response received:",
        JSON.stringify(response, null, 2),
      );
      handleBackendResponse(response);
    } catch (err) {
      console.error("❌ API Error:", err);
    }
  };

  /* ---------- STOP TRACKING ---------- */

  const stopTracking = () => {
    console.log("⏹️ STOP TRACKING clicked");

    isTrackingRef.current = false;
    alertShownRef.current = false;

    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
      console.log("✅ Location subscription removed");
    }

    if (apiInterval.current) {
      clearInterval(apiInterval.current);
      apiInterval.current = null;
    }

    if (responseInterval.current) {
      clearInterval(responseInterval.current);
      responseInterval.current = null;
    }

    if (cooldownTimeout.current) {
      clearTimeout(cooldownTimeout.current);
      cooldownTimeout.current = null;
    }

    if (cooldownTimerInterval.current) {
      clearInterval(cooldownTimerInterval.current);
      cooldownTimerInterval.current = null;
    }

    setTracking(false);
    setShowAlert(false);
    sosTriggered.current = false;
    alertCooldown.current = false;
    setCooldownRemaining(0);

    console.log("✅ Tracking stopped");
    Alert.alert("Tracking Stopped", "Journey tracking has been stopped");
  };

  /* ---------- UPDATE TRAVELED POINTS ---------- */

  const updateTraveledPoints = (location: any) => {
    if (!coords || coords.length === 0) return;

    const nearest = findNearestPointOnRoute(
      location.latitude,
      location.longitude,
      coords,
    );

    console.log("📍 Nearest point:", {
      index: nearest.index,
      distance: nearest.distance.toFixed(2) + "m",
      furthestSoFar: furthestIndex,
    });

    if (nearest.distance < TRAVELED_THRESHOLD) {
      if (nearest.index > furthestIndex) {
        setTraveledPoints((prev) => {
          const newSet = new Set(prev);
          const previousSize = newSet.size;

          for (let i = 0; i <= nearest.index; i++) {
            newSet.add(i);
          }

          if (newSet.size > previousSize) {
            console.log(
              "✅ Progress! Traveled:",
              previousSize,
              "→",
              newSet.size,
              "/",
              coords.length,
            );
            const progressPercent = Math.round(
              (nearest.index / (coords.length - 1)) * 100,
            );
            console.log("📊 Route progress:", progressPercent + "%");
          }

          return newSet;
        });

        setFurthestIndex(nearest.index);
        console.log(
          "🎯 New furthest point:",
          nearest.index,
          "/",
          coords.length - 1,
        );

        // Check if user reached destination
        checkIfReachedDestination(nearest.index, location);
      } else if (nearest.index >= furthestIndex - 5) {
        setTraveledPoints((prev) => {
          const newSet = new Set(prev);
          for (let i = 0; i <= nearest.index; i++) {
            newSet.add(i);
          }
          return newSet;
        });
      } else {
        console.log(
          "⚠️ User backtracked to index",
          nearest.index,
          "(furthest was",
          furthestIndex + ")",
        );
      }
    } else {
      console.log(
        "⚠️ User is",
        nearest.distance.toFixed(2) + "m from route (threshold:",
        TRAVELED_THRESHOLD + "m)",
      );
    }
  };

  /* ---------- CHECK IF REACHED DESTINATION ---------- */

  const checkIfReachedDestination = (currentIndex: number, location: any) => {
    if (!coords || coords.length === 0) return;

    const destinationPoint = coords[coords.length - 1];
    const distanceToDestination = getDistanceFromLatLonInMeters(
      location.latitude,
      location.longitude,
      destinationPoint.lat,
      destinationPoint.lng,
    );

    console.log(
      "🎯 Distance to destination:",
      distanceToDestination.toFixed(2) + "m",
    );

    // Check if user is at the last point OR within destination radius
    const isAtLastPoint = currentIndex === coords.length - 1;
    const isWithinDestinationRadius =
      distanceToDestination <= DESTINATION_RADIUS;

    if (isAtLastPoint || isWithinDestinationRadius) {
      console.log("🎉🎉🎉 DESTINATION REACHED! 🎉🎉🎉");

      // Stop tracking immediately
      stopTracking();

      // Show success alert
      Alert.alert(
        "🎉 Destination Reached!",
        "You have successfully completed your journey. Tracking has been stopped.",
        [{ text: "OK" }],
      );
    }
  };

  /* ---------- HANDLE BACKEND RESPONSE ---------- */

  const handleBackendResponse = (res: any) => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 HANDLING BACKEND RESPONSE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!res) {
      console.log("❌ Response is null!");
      return;
    }

    console.log("📦 Full Response:", JSON.stringify(res, null, 2));
    console.log("🔍 Current State:");
    console.log("  - sosTriggered:", sosTriggered.current);
    console.log("  - showAlert:", showAlert);
    console.log("  - alertShownRef:", alertShownRef.current);
    console.log("  - alertCooldown:", alertCooldown.current);

    if (sosTriggered.current) {
      console.log("⚠️ SOS already triggered, ignoring response");
      return;
    }

    let statusValue = "";
    if (typeof res.status === "string") {
      statusValue = res.status;
    } else if (
      res.status &&
      typeof res.status === "object" &&
      res.status.status
    ) {
      statusValue = res.status.status;
    }

    const statusUpper = String(statusValue).toUpperCase().trim();
    const farIndicator = Boolean(res.far_indicator);

    console.log("🔍 Parsed Values:");
    console.log("  - status (uppercase):", statusUpper);
    console.log("  - far_indicator:", farIndicator);

    const isUnsafe = statusUpper === "UNSAFE" && farIndicator;
    console.log("🔍 Is UNSAFE?", isUnsafe);

    if (isUnsafe) {
      console.log("🚨🚨🚨 UNSAFE DETECTED - USER OFF ROUTE! 🚨🚨🚨");

      if (alertShownRef.current) {
        console.log("⚠️ Alert already showing, skipping");
        return;
      }

      if (alertCooldown.current) {
        console.log("⏰ In cooldown period, skipping alert");
        return;
      }

      console.log("🚨 TRIGGERING ALERT NOW!");

      alertShownRef.current = true;

      console.log("📳 Triggering vibration...");
      Vibration.vibrate([500, 500, 500]);

      console.log("🚨 Setting showAlert to TRUE");
      setShowAlert(true);
      setResponseTimer(RESPONSE_TIME);

      console.log("⏱️ Starting response countdown timer");
      clearInterval(responseInterval.current);
      responseInterval.current = setInterval(() => {
        setResponseTimer((t) => {
          console.log("⏱️ Response timer:", t - 1, "seconds");
          if (t <= 1) {
            console.log("⏱️ Timer expired!");
            clearInterval(responseInterval.current);

            if (!sosTriggered.current) {
              console.log("🆘🆘🆘 NO RESPONSE - TRIGGERING SOS! 🆘🆘🆘");
              sosTriggered.current = true;
              triggerSOS();
              stopTracking();
            }

            return 0;
          }
          return t - 1;
        });
      }, 1000);

      console.log("✅ Alert triggered successfully");
    } else if (statusUpper === "SAFE") {
      console.log("✅ SAFE - User is on route");

      if (alertShownRef.current && showAlert) {
        console.log("🔔 Clearing alert (user back on route)");
        clearInterval(responseInterval.current);
        setShowAlert(false);
        alertShownRef.current = false;
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  };

  /* ---------- CONFIRM SAFE ---------- */

  const confirmSafe = () => {
    console.log("✅✅✅ USER CONFIRMED SAFE ✅✅✅");

    clearInterval(responseInterval.current);
    setShowAlert(false);
    alertShownRef.current = false;
    alertCooldown.current = true;

    const cooldownEndTime = Date.now() + ALERT_COOLDOWN;
    console.log("⏰ Starting cooldown until:", new Date(cooldownEndTime));

    clearInterval(cooldownTimerInterval.current);
    cooldownTimerInterval.current = setInterval(() => {
      const remaining = cooldownEndTime - Date.now();
      if (remaining <= 0) {
        console.log("⏰ Cooldown period ended");
        clearInterval(cooldownTimerInterval.current);
        setCooldownRemaining(0);
        alertCooldown.current = false;
      } else {
        const secs = Math.ceil(remaining / 1000);
        setCooldownRemaining(secs);
      }
    }, 1000);

    clearTimeout(cooldownTimeout.current);
    cooldownTimeout.current = setTimeout(() => {
      console.log("⏰ Cooldown timeout complete");
      alertCooldown.current = false;
      clearInterval(cooldownTimerInterval.current);
      setCooldownRemaining(0);
    }, ALERT_COOLDOWN);

    Alert.alert("Confirmed", "You won't be alerted again for 1 minute");
  };

  /* ---------- RECENTER MAP ---------- */

  const recenterMap = () => {
    console.log("🎯 Recenter button clicked");
    if (currentLocation && mapRef.current) {
      setUserMovedMap(false);
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
      console.log("✅ Map recentered");
    }
  };

  /* ---------- RENDER ---------- */

  if (!coords) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, color: "#666" }}>
          No route data available
        </Text>
      </View>
    );
  }

  const remainingRoute = coords.filter((_, idx) => !traveledPoints.has(idx));
  const traveledRoute = coords.filter((_, idx) => traveledPoints.has(idx));

  return (
    <View style={{ flex: 1 }}>
      {/* Progress Bar */}
      {tracking && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            zIndex: 1000,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333" }}>
              Route Progress
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#2196f3" }}>
              {calculateProgress(traveledPoints, coords.length)}%
            </Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: "#e0e0e0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                backgroundColor: "#4caf50",
                width: `${calculateProgress(traveledPoints, coords.length)}%`,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: coords[0].lat,
          longitude: coords[0].lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        followsUserLocation={false}
        onPanDrag={() => setUserMovedMap(true)}
        onRegionChangeComplete={() => {
          if (tracking) setUserMovedMap(true);
        }}
      >
        {traveledRoute.length > 1 && (
          <Polyline
            coordinates={traveledRoute.map((p) => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            strokeWidth={5}
            strokeColor="#9e9e9e"
            lineDashPattern={[1]}
          />
        )}

        {remainingRoute.length > 1 && (
          <Polyline
            coordinates={remainingRoute.map((p) => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            strokeWidth={5}
            strokeColor="#d32f2f"
          />
        )}

        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            pinColor="blue"
            title="You are here"
          />
        )}
      </MapView>

      {showAlert && (
        <EmergencyAlert
          responseTimer={responseTimer}
          onConfirmSafe={confirmSafe}
        />
      )}

      {alertCooldown.current && tracking && cooldownRemaining > 0 && (
        <CooldownBanner cooldownRemaining={cooldownRemaining} />
      )}

      {tracking && userMovedMap && currentLocation && (
        <TouchableOpacity
          onPress={recenterMap}
          style={{
            position: "absolute",
            top: alertCooldown.current ? 200 : 140,
            right: 20,
            backgroundColor: "#2196f3",
            padding: 12,
            borderRadius: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 5,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Recenter</Text>
        </TouchableOpacity>
      )}

      <TrackingControls
        tracking={tracking}
        isInitializing={isInitializing}
        onStart={startTracking}
        onStop={stopTracking}
      />
    </View>
  );
}
