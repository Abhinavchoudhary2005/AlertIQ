import numpy as np

def compute_temporal_features(buffer):
    speeds = [p["speed"] for p in buffer]
    accels = [p["accel_mag"] for p in buffer]
    gyros  = [p["gyro_mag"] for p in buffer]

    return [
        np.var(speeds),
        np.var(accels),
        np.var(gyros),
        len(buffer),
    ]
