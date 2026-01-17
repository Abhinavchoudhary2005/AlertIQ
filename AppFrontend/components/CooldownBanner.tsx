// app/components/CooldownBanner.tsx
import React from "react";
import { View, Text } from "react-native";
import { formatTime } from "../utils/geoUtils";

interface CooldownBannerProps {
  cooldownRemaining: number;
}

const CooldownBanner: React.FC<CooldownBannerProps> = ({
  cooldownRemaining,
}) => {
  return (
    <View
      style={{
        position: "absolute",
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        flexDirection: "row",
        alignItems: "center",
        borderLeftWidth: 4,
        borderLeftColor: "#2e7d32",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "#e8f5e9",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        }}
      >
        <Text style={{ fontSize: 20 }}>✓</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: "#2e7d32",
            marginBottom: 2,
          }}
        >
          Safe Mode Active
        </Text>
      </View>
      <View
        style={{
          backgroundColor: "#2e7d32",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "700",
          }}
        >
          {formatTime(cooldownRemaining)}
        </Text>
      </View>
    </View>
  );
};

export default CooldownBanner;
