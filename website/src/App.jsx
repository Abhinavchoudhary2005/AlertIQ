import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom red marker icon
const redIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCAzMiA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgNDhMMTYgMTZNMTYgMTZDMjIuNjI3NCAxNiAyOCAxMC42Mjc0IDI4IDRDMjggLTIuNjI3NCAyMi42Mjc0IC04IDE2IC04QzkuMzczIC04IDQgLTIuNjI3NCA0IDRDNCAxMC42Mjc0IDkuMzczIDE2IDE2IDE2WiIgZmlsbD0iI0RDMjYyNiIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iNCIgcj0iNCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=",
  iconSize: [32, 48],
  iconAnchor: [16, 48],
  popupAnchor: [0, -48],
});

// Component to handle map bounds updates
function MapController({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 1) {
      const bounds = L.latLngBounds(locations);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (locations.length === 1) {
      map.setView(locations[0], 16);
    }
  }, [locations, map]);

  return null;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [ended, setEnded] = useState(false);
  const eventSourceRef = useRef(null);

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api/sos";
  const sessionId = window.location.pathname.split("/").pop();

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource(`${API_URL}/stream/${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "init") {
        setSessionData({
          userName: data.session.userName,
          createdAt: data.session.createdAt,
        });

        if (data.session.locations && data.session.locations.length > 0) {
          const locs = data.session.locations.map((loc) => [loc.lat, loc.lng]);
          setLocations(locs);
          setUpdateCount(data.session.locations.length);
          setLastUpdate(
            new Date(
              data.session.locations[data.session.locations.length - 1]
                .timestamp,
            ),
          );
        }

        if (data.session.ended) {
          setEnded(true);
        }

        setLoading(false);
      } else if (data.type === "update") {
        const newLoc = [data.location.lat, data.location.lng];
        setLocations((prev) => [...prev, newLoc]);
        setUpdateCount((prev) => prev + 1);
        setLastUpdate(new Date(data.location.timestamp));
      } else if (data.type === "ended") {
        setEnded(true);
      }
    });

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      if (eventSource.readyState === EventSource.CLOSED) {
        setError(true);
        setLoading(false);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [API_URL, sessionId]);

  const getTimeAgo = (date) => {
    if (!date) return "Unknown";

    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading tracking session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-panel">
          <h2>⚠️ Session Not Found</h2>
          <p>
            This tracking session has expired or does not exist. Emergency
            tracking sessions are active for 24 hours.
          </p>
        </div>
      </div>
    );
  }

  const currentPosition =
    locations.length > 0 ? locations[locations.length - 1] : [0, 0];

  return (
    <div className="app">
      <div className="info-panel">
        <h2>{sessionData?.userName || "User"}</h2>
        <div className="subtitle">Emergency Alert</div>

        <div className={`status ${ended ? "ended" : "active"}`}>
          {!ended && <div className="pulse-dot"></div>}
          <span>{ended ? "✅ User is Safe" : "Live Tracking"}</span>
        </div>

        <div className="info-row">
          <svg
            className="icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <strong>Last Update:</strong>
            <br />
            <span>{getTimeAgo(lastUpdate)}</span>
          </div>
        </div>

        <div className="info-row">
          <svg
            className="icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            ></path>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            ></path>
          </svg>
          <div>
            <strong>Updates:</strong>
            <br />
            <span>{updateCount} locations received</span>
          </div>
        </div>
      </div>

      {locations.length > 0 && (
        <MapContainer
          center={currentPosition}
          zoom={16}
          style={{ height: "100vh", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController locations={locations} />

          <Circle
            center={currentPosition}
            radius={50}
            pathOptions={{
              color: "#dc2626",
              fillColor: "#fee2e2",
              fillOpacity: 0.3,
            }}
          />

          <Marker position={currentPosition} icon={redIcon}>
            <Popup>Current Location</Popup>
          </Marker>

          {locations.length > 1 && (
            <Polyline
              positions={locations}
              pathOptions={{
                color: "#dc2626",
                weight: 3,
                opacity: 0.7,
              }}
            />
          )}
        </MapContainer>
      )}
    </div>
  );
}

export default App;
