// app/components/EmergencyAlert.tsx
import React from "react";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface EmergencyAlertProps {
  responseTimer: number;
  onConfirmSafe: () => void;
}

const EmergencyAlert: React.FC<EmergencyAlertProps> = ({
  responseTimer,
  onConfirmSafe,
}) => {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <View
        style={{
          backgroundColor: "#fff",
          marginHorizontal: 30,
          borderRadius: 20,
          padding: 30,
          width: SCREEN_WIDTH - 60,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 20,
        }}
      >
        {/* Warning Icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#ffebee",
            alignSelf: "center",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 48 }}>⚠️</Text>
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: "#c62828",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          Are You Safe?
        </Text>

        {/* Description */}
        <Text
          style={{
            fontSize: 15,
            color: "#666",
            textAlign: "center",
            marginBottom: 20,
            lineHeight: 22,
          }}
        >
          You appear to be off your planned route. Please confirm your safety.
        </Text>

        {/* Countdown Circle */}
        <View
          style={{
            alignSelf: "center",
            marginBottom: 25,
          }}
        >
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "#ffebee",
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 4,
              borderColor: responseTimer <= 3 ? "#c62828" : "#ff5252",
            }}
          >
            <Text
              style={{
                fontSize: 36,
                fontWeight: "900",
                color: "#c62828",
              }}
            >
              {responseTimer}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: "#c62828",
                fontWeight: "600",
                marginTop: -2,
              }}
            >
              seconds
            </Text>
          </View>
        </View>

        {/* Warning Text */}
        <Text
          style={{
            fontSize: 13,
            color: "#d32f2f",
            textAlign: "center",
            marginBottom: 25,
            fontWeight: "600",
          }}
        >
          SOS will be triggered automatically if no response
        </Text>

        {/* Action Button */}
        <TouchableOpacity
          onPress={onConfirmSafe}
          style={{
            backgroundColor: "#2e7d32",
            paddingVertical: 16,
            borderRadius: 12,
            shadowColor: "#2e7d32",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontSize: 18,
              fontWeight: "700",
              letterSpacing: 0.5,
            }}
          >
            Yes, I`m Safe
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EmergencyAlert;
