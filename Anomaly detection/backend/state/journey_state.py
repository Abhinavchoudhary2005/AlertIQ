import time

STATE = {}

STOP_RADIUS = 10        # meters
STOP_TIME = 60          # seconds
SHOCK_THRESHOLD = 30    # m/s²

def update(uid, location, accel_mag):
    now = time.time()

    if uid not in STATE:
        STATE[uid] = {
            "last_loc": location,
            "last_move": now
        }
        return False

    dist = location
    if accel_mag < 1.2:
        stopped_time = now - STATE[uid]["last_move"]
        if stopped_time >= STOP_TIME:
            return True
    else:
        STATE[uid]["last_move"] = now
        STATE[uid]["last_loc"] = location

    return False
