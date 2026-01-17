import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

interface TrackingControlsProps {
  tracking: boolean;
  isInitializing?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function TrackingControls({
  tracking,
  isInitializing = false,
  onStart,
  onStop,
}: TrackingControlsProps) {
  return (
    <View style={styles.container}>
      {!tracking ? (
        <TouchableOpacity
          style={[
            styles.button,
            styles.startButton,
            isInitializing && styles.disabledButton,
          ]}
          onPress={onStart}
          disabled={isInitializing}
          activeOpacity={0.85}
        >
          {isInitializing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>Initializing</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Start Tracking</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.stopButton]}
          onPress={onStop}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Stop Tracking</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
    alignItems: "center",
  },

  button: {
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    minWidth: 220,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  startButton: {
    backgroundColor: "#0f9440",
  },

  stopButton: {
    backgroundColor: "#ef4444",
  },

  disabledButton: {
    backgroundColor: "#9ca3af",
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
