// Home.tsx - Add useMemo to stabilize the callback
import { View, StyleSheet, Alert, ActivityIndicator, Text } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { auth } from "../../config/firebase";
import { triggerSOS } from "../../utils/sosTrigger";
import { useVoiceDetection } from "../../hooks/useVoiceDetection";
import { RouteOption } from "../../types";
import SearchOverlay from "../../components/SearchOverlay";
import SearchInputsCard from "../../components/SearchInputsCard";
import RouteInfoCard from "../../components/RouteInfoCard";
import SOSButton from "../../components/SOSButton";
import MapSelectionOverlay from "../../components/MapSelectionOverlay";

const ROUTE_COLORS = [
  { stroke: "#1976d2", strokeInactive: "rgba(25,118,210,0.3)" },
  { stroke: "#388e3c", strokeInactive: "rgba(56,142,60,0.3)" },
  { stroke: "#f57c00", strokeInactive: "rgba(245,124,0,0.3)" },
];

export default function Home() {
  const [start, setStart] = useState<any>(null);
  const [end, setEnd] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<number>(0);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<
    "start" | "end" | null
  >(null);
  const [mapSelectionMode, setMapSelectionMode] = useState<
    "start" | "end" | null
  >(null);
  const [tempMarker, setTempMarker] = useState<any>(null);

  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<any>(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const VOICE_API_URL = process.env.EXPO_PUBLIC_VOICE_API_URL;
  const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY;

  // Memoize the SOS handler to prevent it from changing on every render
  const handleSOSTrigger = useCallback(async () => {
    if (sosLoading) return;
    setSosLoading(true);
    try {
      await triggerSOS();
      Alert.alert("SOS Triggered", "Emergency contacts have been notified");
    } catch (err) {
      console.log("SOS Error:", err);
      Alert.alert("Error", "Failed to trigger SOS");
    } finally {
      setTimeout(() => setSosLoading(false), 3000);
    }
  }, [sosLoading]);

  // Only call the hook once with stable dependencies
  useVoiceDetection(VOICE_API_URL, handleSOSTrigger);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission is required");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(coords);
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        1000,
      );

      locationSubscription.current = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }, 3000);
    })();

    return () => {
      if (locationSubscription.current)
        clearInterval(locationSubscription.current);
    };
  }, []);

  useEffect(() => {
    if (routeOptions.length > 0 && mapRef.current) {
      const allCoords = routeOptions[selectedRoute].coords;
      if (allCoords.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 200, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }, 300);
      }
    }
  }, [selectedRoute, routeOptions]);

  const fetchRouteOptions = async (a: any, b: any, waypoints: any[] = []) => {
    setLoading(true);
    try {
      const coordinates = [
        [a.longitude, a.latitude],
        ...waypoints.map((s) => [s.longitude, s.latitude]),
        [b.longitude, b.latitude],
      ];

      const res = await fetch(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        {
          method: "POST",
          headers: {
            Authorization: ORS_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coordinates,
            alternative_routes: { target_count: 3 },
            extra_info: ["waytype", "surface"],
          }),
        },
      );

      const data = await res.json();

      if (!data.features || data.features.length === 0) {
        Alert.alert(
          "No Route Found",
          "Could not find a route between these locations",
        );
        return;
      }

      const routes = data.features.map((feature: any, idx: number) => {
        const segment = feature.properties.segments[0];
        const steps = segment.steps || [];

        const mainRoads = steps
          .filter((step: any) => step.name && step.name !== "-")
          .slice(0, 3)
          .map((step: any) => step.name);

        const summary =
          mainRoads.length > 0 ? mainRoads.join(", ") : `Route ${idx + 1}`;

        return {
          coords: feature.geometry.coordinates.map(([lng, lat]: any) => ({
            latitude: lat,
            longitude: lng,
          })),
          distance: segment.distance,
          duration: segment.duration,
          summary:
            summary.length > 50 ? summary.substring(0, 47) + "..." : summary,
        };
      });

      setRouteOptions(routes);
      setSelectedRoute(0);
    } catch (err) {
      Alert.alert("Error", "Failed to fetch routes");
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const saveRoute = async (routeName: string) => {
    const user = auth.currentUser;

    if (!user || routeOptions.length === 0) {
      Alert.alert("Error", "Select start and end points");
      return;
    }

    if (!routeName.trim()) {
      Alert.alert("Error", "Please enter a route name");
      return;
    }

    try {
      await fetch(`${API_URL}/user/save-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          name: routeName,
          route: routeOptions[selectedRoute].coords.map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
          })),
        }),
      });

      Alert.alert("Success", "Route Saved ✅");
      clearRoute();
    } catch (err) {
      Alert.alert("Error", "Failed to save route");
      console.log("Save Route Error:", err);
    }
  };

  const clearRoute = () => {
    setStart(null);
    setEnd(null);
    setStops([]);
    setRouteOptions([]);
    setSelectedRoute(0);
  };

  const handleStartChange = (location: any) => {
    setStart(location);
    if (end) {
      fetchRouteOptions(location, end, stops);
    }
  };

  const handleEndChange = (location: any) => {
    setEnd(location);
    if (start) {
      fetchRouteOptions(start, location, stops);
    }
  };

  const openSearchOverlay = (field: "start" | "end") => {
    setActiveSearchField(field);
    setSearchOverlayVisible(true);
  };

  const handleSelectLocation = (location: any) => {
    if (activeSearchField === "start") {
      handleStartChange(location);
    } else if (activeSearchField === "end") {
      handleEndChange(location);
    }
    setSearchOverlayVisible(false);
  };

  const handleSelectFromMap = () => {
    setSearchOverlayVisible(false);
    setMapSelectionMode(activeSearchField);
  };

  const handleMapPress = (event: any) => {
    if (!mapSelectionMode) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setTempMarker({ latitude, longitude });
  };

  const confirmMapSelection = async () => {
    if (!tempMarker) return;

    try {
      const res = await fetch(
        `https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_KEY}&point.lon=${tempMarker.longitude}&point.lat=${tempMarker.latitude}`,
      );
      const data = await res.json();

      let label = "Selected Location";
      if (data.features?.[0]?.properties?.label) {
        label = data.features[0].properties.label;
      }

      const location = {
        ...tempMarker,
        label,
      };

      if (mapSelectionMode === "start") {
        handleStartChange(location);
      } else if (mapSelectionMode === "end") {
        handleEndChange(location);
      }
    } catch (err) {
      console.log("Reverse geocoding error:", err);
      const location = {
        ...tempMarker,
        label: "Selected Location",
      };

      if (mapSelectionMode === "start") {
        handleStartChange(location);
      } else if (mapSelectionMode === "end") {
        handleEndChange(location);
      }
    }

    setTempMarker(null);
    setMapSelectionMode(null);
  };

  const cancelMapSelection = () => {
    setTempMarker(null);
    setMapSelectionMode(null);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        region={
          currentLocation
            ? { ...currentLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : {
                latitude: 20.5937,
                longitude: 78.9629,
                latitudeDelta: 15,
                longitudeDelta: 15,
              }
        }
      >
        {currentLocation && (
          <Marker coordinate={currentLocation} title="You">
            <View style={styles.currentLocationMarker}>
              <View style={styles.currentLocationDot} />
            </View>
          </Marker>
        )}

        {start && (
          <Marker coordinate={start} title="Start">
            <View style={styles.startMarker}>
              <Text style={styles.markerText}>A</Text>
            </View>
          </Marker>
        )}

        {end && (
          <Marker coordinate={end} title="End">
            <View style={styles.endMarker}>
              <Text style={styles.markerText}>B</Text>
            </View>
          </Marker>
        )}

        {tempMarker && (
          <Marker coordinate={tempMarker}>
            <View style={styles.tempMarker}>
              <Text style={styles.tempMarkerText}>📍</Text>
            </View>
          </Marker>
        )}

        {routeOptions.map((route, i) => {
          if (i === selectedRoute) return null;
          const colors = ROUTE_COLORS[i % ROUTE_COLORS.length];
          return (
            <Polyline
              key={`route-${i}`}
              coordinates={route.coords}
              strokeWidth={3}
              strokeColor={colors.strokeInactive}
              lineDashPattern={[1, 2]}
            />
          );
        })}

        {routeOptions.length > 0 && (
          <Polyline
            coordinates={routeOptions[selectedRoute].coords}
            strokeWidth={6}
            strokeColor={
              ROUTE_COLORS[selectedRoute % ROUTE_COLORS.length].stroke
            }
            lineJoin="round"
            lineCap="round"
          />
        )}
      </MapView>

      <SOSButton loading={sosLoading} onPress={handleSOSTrigger} />

      <SearchInputsCard
        start={start}
        end={end}
        onStartPress={() => openSearchOverlay("start")}
        onEndPress={() => openSearchOverlay("end")}
        onClearStart={() => setStart(null)}
        onClearEnd={() => setEnd(null)}
        onClearAll={clearRoute}
      />

      {routeOptions.length > 0 && (
        <RouteInfoCard
          routeOptions={routeOptions}
          selectedRoute={selectedRoute}
          onSelectRoute={setSelectedRoute}
          onSaveRoute={saveRoute}
          onShare={() => Alert.alert("Share", "Share route functionality")}
          onStart={() => Alert.alert("Navigate", "Start navigation")}
        />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Finding routes...</Text>
          </View>
        </View>
      )}

      <MapSelectionOverlay
        visible={!!mapSelectionMode}
        mode={mapSelectionMode}
        hasMarker={!!tempMarker}
        onConfirm={confirmMapSelection}
        onCancel={cancelMapSelection}
      />

      <SearchOverlay
        visible={searchOverlayVisible}
        placeholder={
          activeSearchField === "start"
            ? "Search start location"
            : "Search destination"
        }
        currentLocation={currentLocation}
        orsKey={ORS_KEY!}
        onClose={() => setSearchOverlayVisible(false)}
        onSelectLocation={handleSelectLocation}
        onSelectFromMap={handleSelectFromMap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  currentLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(25, 118, 210, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1976d2",
    borderWidth: 2,
    borderColor: "#fff",
  },
  startMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4caf50",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  endMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f44336",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  tempMarker: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  tempMarkerText: {
    fontSize: 32,
  },
});
