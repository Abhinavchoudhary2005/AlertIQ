from collections import deque

TEMPORAL_BUFFER = {}
WINDOW_SECONDS = 60

def update_buffer(uid, data):
    if uid not in TEMPORAL_BUFFER:
        TEMPORAL_BUFFER[uid] = deque()

    TEMPORAL_BUFFER[uid].append(data)

    now = data["timestamp"]
    while TEMPORAL_BUFFER[uid] and now - TEMPORAL_BUFFER[uid][0]["timestamp"] > WINDOW_SECONDS:
        TEMPORAL_BUFFER[uid].popleft()

    return TEMPORAL_BUFFER[uid]
