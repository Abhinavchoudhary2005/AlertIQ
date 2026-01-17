import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useState } from "react";
import { auth } from "../../config/firebase";
import { useRouter, useFocusEffect } from "expo-router";

export default function Routes() {
  const [routes, setRoutes] = useState<any[]>([]);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const router = useRouter();

  useFocusEffect(() => {
    const user = auth.currentUser;

    fetch(`${API_URL}/user/route/${user?.uid}`)
      .then((res) => res.json())
      .then((data) => setRoutes(data || []));
  });

  if (!routes.length) {
    return (
      <View style={{ padding: 20 }}>
        <Text>No routes saved yet</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Saved Routes</Text>

      <FlatList
        data={routes}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(tabs)/view-route",
                params: { route: JSON.stringify(item.points) },
              })
            }
            style={{
              backgroundColor: "#e3f2fd",
              padding: 15,
              borderRadius: 10,
              marginTop: 10,
            }}
          >
            <Text style={{ fontWeight: "600" }}>{item.name}</Text>
            <Text>{item.points.length} points</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
