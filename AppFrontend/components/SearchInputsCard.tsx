// components/SearchInputsCard.tsx
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";

interface SearchInputsCardProps {
  start: any;
  end: any;
  onStartPress: () => void;
  onEndPress: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
  onClearAll: () => void;
}

export default function SearchInputsCard({
  start,
  end,
  onStartPress,
  onEndPress,
  onClearStart,
  onClearEnd,
  onClearAll,
}: SearchInputsCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Start Input */}
        <TouchableOpacity style={styles.inputWrapper} onPress={onStartPress}>
          <View style={styles.startDot} />
          <Text
            style={[styles.inputText, !start && styles.placeholderText]}
            numberOfLines={1}
          >
            {start?.label || "Choose start location"}
          </Text>
          {start && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onClearStart();
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* End Input */}
        <TouchableOpacity style={styles.inputWrapper} onPress={onEndPress}>
          <View style={styles.endDot} />
          <Text
            style={[styles.inputText, !end && styles.placeholderText]}
            numberOfLines={1}
          >
            {end?.label || "Choose destination"}
          </Text>
          {end && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onClearEnd();
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Clear All Button */}
        {(start || end) && (
          <TouchableOpacity onPress={onClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear Route</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 90,
    zIndex: 100,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4caf50",
    marginRight: 12,
  },
  endDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#f44336",
    marginRight: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
  },
  placeholderText: {
    color: "#999",
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  clearText: {
    fontSize: 12,
    color: "#666",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginLeft: 40,
  },
  clearAllBtn: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  clearAllText: {
    fontSize: 13,
    color: "#1976d2",
    fontWeight: "600",
  },
});
