from fastapi import FastAPI
from pydantic import BaseModel
from collections import deque
import numpy as np

from backend.ai.model_store import ROUTES, TEMPORAL_MODELS
from backend.ai.train_temporal import train_temporal_model

from backend.features.geo import point_to_segment_distance
from backend.features.motion import accel_magnitude, gyro_magnitude
from backend.state.journey_state import SHOCK_THRESHOLD

app = FastAPI()

D1 = 50
D2 = 150

WINDOW_SECONDS = 60
MIN_POINTS_FOR_AI = 6

AI_SCORE_THRESHOLD = -0.06 

TEMPORAL_BUFFER = {}

class RouteInit(BaseModel):
    uid: str
    route: list


class LiveData(BaseModel):
    uid: str
    lat: float
    lng: float
    accel: list
    gyro: list
    timestamp: float

def update_temporal_buffer(uid, entry):
    if uid not in TEMPORAL_BUFFER:
        TEMPORAL_BUFFER[uid] = deque()

    TEMPORAL_BUFFER[uid].append(entry)

    while (
        TEMPORAL_BUFFER[uid]
        and entry["timestamp"] - TEMPORAL_BUFFER[uid][0]["timestamp"] > WINDOW_SECONDS
    ):
        TEMPORAL_BUFFER[uid].popleft()

    return TEMPORAL_BUFFER[uid]


def compute_temporal_features(buffer):
    speeds = [p["speed"] for p in buffer]
    accels = [p["accel_mag"] for p in buffer]
    gyros = [p["gyro_mag"] for p in buffer]

    return [
        np.var(speeds),
        np.var(accels),
        np.var(gyros),
        len(buffer)
    ]

@app.post("/init-route")
def init_route(data: RouteInit):
    ROUTES[data.uid] = data.route
    TEMPORAL_MODELS[data.uid] = train_temporal_model()
    TEMPORAL_BUFFER[data.uid] = deque()

    return {
        "status": "MODEL_TRAINED",
        "uid": data.uid
    }

@app.post("/live-point")
def live_point(data: LiveData):

    route = ROUTES.get(data.uid)
    temporal_model = TEMPORAL_MODELS.get(data.uid)

    if route is None or temporal_model is None:
        return {"error": "Route not initialized"}

    accel_mag = accel_magnitude(data.accel)
    gyro_mag = gyro_magnitude(data.gyro)

    if accel_mag >= SHOCK_THRESHOLD:
        return {
            "status": "ANOMALY",
            "reason": "SHOCK_DETECTED",
            "accel_magnitude": accel_mag,
            "far_indicator": False
        }
    
    live_point = (data.lat, data.lng)
    min_dist = min(
        point_to_segment_distance(
            live_point,
            (route[i]["lat"], route[i]["lng"]),
            (route[i + 1]["lat"], route[i + 1]["lng"])
        )
        for i in range(len(route) - 1)
    )

    buffer = update_temporal_buffer(
        data.uid,
        {
            "timestamp": data.timestamp,
            "speed": 1.5, 
            "accel_mag": accel_mag,
            "gyro_mag": gyro_mag
        }
    )

    ai_pred = 1
    ai_score = 0.0

    if len(buffer) >= MIN_POINTS_FOR_AI:
        features = compute_temporal_features(buffer)
        ai_score = temporal_model.decision_function([features])[0]
        ai_pred = temporal_model.predict([features])[0]

    if min_dist > D2:
        if ai_pred == -1 or ai_score < AI_SCORE_THRESHOLD:
            return {
                "status": "ANOMALY",
                "reason": "ABNORMAL_BEHAVIOR_OVER_TIME",
                "distance": min_dist,
                "far_indicator": True,
                "ai_score": ai_score,
                "buffer_size": len(buffer)
            }

        return {
            "status": "UNSAFE",
            "risk_level": "HIGH",
            "distance": min_dist,
            "far_indicator": True
        }

    elif min_dist > D1:
        return {
            "status": "UNSAFE",
            "risk_level": "MEDIUM",
            "distance": min_dist,
            "far_indicator": False
        }

    else:
        return {
            "status": "SAFE",
            "distance": min_dist,
            "far_indicator": False
        }

