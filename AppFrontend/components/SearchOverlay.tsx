// components/SearchOverlay.tsx
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Keyboard,
} from "react-native";
import { useState, useEffect, useRef } from "react";

interface SearchOverlayProps {
  visible: boolean;
  placeholder: string;
  currentLocation: any;
  orsKey: string;
  onClose: () => void;
  onSelectLocation: (location: any) => void;
  onSelectFromMap: () => void;
}

interface Suggestion {
  label: string;
  coords: {
    latitude: number;
    longitude: number;
  };
  address?: string;
}

export default function SearchOverlay({
  visible,
  placeholder,
  currentLocation,
  orsKey,
  onClose,
  onSelectLocation,
  onSelectFromMap,
}: SearchOverlayProps) {
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // Auto-focus input when overlay opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Reset state when closed
      setSearchText("");
      setSuggestions([]);
      setLoading(false);
    }
  }, [visible]);

  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const encodedQuery = encodeURIComponent(query);
      const res = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodedQuery}&size=10&boundary.country=IN&focus.point.lon=78.9629&focus.point.lat=20.5937`
      );

      const data = await res.json();

      if (data.features?.length > 0) {
        const formatted = data.features
          .filter((f: any) => {
            const props = f.properties;
            return (
              props.country_a === "IND" ||
              props.country === "India" ||
              props.label?.includes("India")
            );
          })
          .map((f: any) => ({
            label: f.properties.name || f.properties.label,
            address: f.properties.label,
            coords: {
              latitude: f.geometry.coordinates[1],
              longitude: f.geometry.coordinates[0],
            },
          }));

        setSuggestions(formatted);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.log("Search error:", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setSearchText(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchLocation(text);
    }, 500);
  };

  const handleSelectLocation = (suggestion: Suggestion) => {
    Keyboard.dismiss();
    onSelectLocation({
      ...suggestion.coords,
      label: suggestion.label,
    });
    onClose();
  };

  const handleCurrentLocation = () => {
    if (!currentLocation) return;

    Keyboard.dismiss();
    onSelectLocation({
      ...currentLocation,
      label: "Current Location",
    });
    onClose();
  };

  const handleSelectFromMap = () => {
    Keyboard.dismiss();
    onSelectFromMap();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Search Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              placeholder={placeholder}
              value={searchText}
              onChangeText={handleTextChange}
              style={styles.searchInput}
              placeholderTextColor="#999"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchText("");
                  setSuggestions([]);
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={handleCurrentLocation}
          >
            <View style={styles.quickActionIcon}>
              <Text style={styles.iconText}>📍</Text>
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionTitle}>Current Location</Text>
              <Text style={styles.quickActionSubtitle}>Use my location</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={handleSelectFromMap}
          >
            <View style={styles.quickActionIcon}>
              <Text style={styles.iconText}>🗺️</Text>
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionTitle}>Choose on map</Text>
              <Text style={styles.quickActionSubtitle}>
                Tap location on map
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {/* Search Results */}
        {!loading && suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.label}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleSelectLocation(item)}
              >
                <View style={styles.resultIcon}>
                  <Text style={styles.resultIconText}>📍</Text>
                </View>
                <View style={styles.resultContent}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.address && item.address !== item.label && (
                    <Text style={styles.resultAddress} numberOfLines={2}>
                      {item.address}
                    </Text>
                  )}
                </View>
                <Text style={styles.resultArrow}>→</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
          />
        )}

        {/* No Results */}
        {!loading && searchText.length >= 3 && suggestions.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsIcon}>🔍</Text>
            <Text style={styles.noResultsTitle}>No results found</Text>
            <Text style={styles.noResultsText}>
              Try searching with a different keyword
            </Text>
          </View>
        )}

        {/* Empty State */}
        {searchText.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🔍</Text>
            <Text style={styles.emptyStateText}>
              Search for a location or choose from map
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  backIcon: {
    fontSize: 28,
    color: "#212121",
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    padding: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  clearIcon: {
    fontSize: 14,
    color: "#666",
    fontWeight: "bold",
  },
  quickActions: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  iconText: {
    fontSize: 20,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: "#757575",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#757575",
  },
  resultsList: {
    paddingVertical: 8,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resultIconText: {
    fontSize: 18,
  },
  resultContent: {
    flex: 1,
    marginRight: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 13,
    color: "#757575",
    lineHeight: 18,
  },
  resultArrow: {
    fontSize: 20,
    color: "#bdbdbd",
  },
  noResults: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  noResultsIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.3,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: "#757575",
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#757575",
    textAlign: "center",
  },
});
