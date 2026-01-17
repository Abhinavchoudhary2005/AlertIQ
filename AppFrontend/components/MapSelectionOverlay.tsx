// components/MapSelectionOverlay.tsx
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";

interface MapSelectionOverlayProps {
  visible: boolean;
  mode: "start" | "end" | null;
  hasMarker: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MapSelectionOverlay({
  visible,
  mode,
  hasMarker,
  onConfirm,
  onCancel,
}: MapSelectionOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {mode === "start" && "Select Start Location"}
          {mode === "end" && "Select End Location"}
        </Text>
        <Text style={styles.subtitle}>Tap anywhere on the map</Text>

        {hasMarker ? (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.actionBtn, styles.cancelBtn]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.actionBtn, styles.confirmBtn]}
            >
              <Text style={styles.confirmBtnText}>✓ Confirm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onCancel} style={styles.cancelOnlyBtn}>
            <Text style={styles.cancelOnlyBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#757575",
    textAlign: "center",
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cancelBtnText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmBtn: {
    backgroundColor: "#1976d2",
  },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  cancelOnlyBtn: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cancelOnlyBtnText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 15,
  },
});
