// components/RouteInfoCard.tsx
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Animated,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { RouteOption } from "../types";

interface RouteInfoCardProps {
  routeOptions: RouteOption[];
  selectedRoute: number;
  onSelectRoute: (index: number) => void;
  onSaveRoute: (name: string) => void;
  onShare: () => void;
  onStart: () => void;
}

const ROUTE_COLORS = [
  { stroke: "#1976d2" },
  { stroke: "#388e3c" },
  { stroke: "#f57c00" },
];

export default function RouteInfoCard({
  routeOptions,
  selectedRoute,
  onSelectRoute,
  onSaveRoute,
}: RouteInfoCardProps) {
  const [routeName, setRouteName] = useState("");
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [slideAnim]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km < 1 ? `${meters.toFixed(0)} m` : `${km.toFixed(1)} km`;
  };

  const handleSave = () => {
    onSaveRoute(routeName);
    setRouteName("");
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      {/* Route Tabs */}
      <View style={styles.routeTabs}>
        {routeOptions.map((route, i) => {
          const isSelected = selectedRoute === i;
          const colors = ROUTE_COLORS[i % ROUTE_COLORS.length];

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.routeTab,
                isSelected && {
                  borderBottomColor: colors.stroke,
                  borderBottomWidth: 3,
                },
              ]}
              onPress={() => onSelectRoute(i)}
            >
              <Text
                style={[
                  styles.routeTabDuration,
                  isSelected && { color: colors.stroke },
                ]}
              >
                {formatDuration(route.duration)}
              </Text>
              <Text style={styles.routeTabDistance}>
                {formatDistance(route.distance)}
              </Text>
              {i === 0 && <Text style={styles.fastestBadge}>Fastest</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Route Details */}
      <View style={styles.routeDetails}>
        <View style={styles.routeViaContainer}>
          <Text style={styles.routeViaLabel}>via</Text>
          <Text style={styles.routeViaText} numberOfLines={1}>
            {routeOptions[selectedRoute].summary}
          </Text>
        </View>
      </View>

      {/* Always Visible Save Input */}
      <View style={styles.saveInputContainer}>
        <TextInput
          style={styles.saveInput}
          placeholder="Route name"
          value={routeName}
          onChangeText={setRouteName}
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={handleSave} style={styles.saveConfirmBtn}>
          <Text style={styles.saveConfirmText}>Save</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    paddingBottom: 20,
  },
  routeTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  routeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  routeTabDuration: {
    fontSize: 16,
    fontWeight: "700",
    color: "#666",
    marginBottom: 2,
  },
  routeTabDistance: {
    fontSize: 12,
    color: "#999",
  },
  fastestBadge: {
    fontSize: 10,
    color: "#4caf50",
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
  },
  routeDetails: {
    padding: 16,
  },
  routeViaContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeViaLabel: {
    fontSize: 14,
    color: "#757575",
    marginRight: 8,
  },
  routeViaText: {
    flex: 1,
    fontSize: 14,
    color: "#212121",
    fontWeight: "500",
  },
  saveInputContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  saveInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveConfirmBtn: {
    backgroundColor: "#1976d2",
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
  },
  saveConfirmText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
