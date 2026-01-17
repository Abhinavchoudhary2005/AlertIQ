import math
from geopy.distance import geodesic


def haversine(p1, p2):
    """Fallback / utility distance (meters)"""
    return geodesic(p1, p2).meters


def _to_xy(coord):
    """
    Convert lat/lng to approximate Cartesian meters
    Suitable for short distances (route-level accuracy)
    """
    lat, lng = coord
    x = lng * 111320 * math.cos(math.radians(lat))
    y = lat * 110540
    return x, y


def point_to_segment_distance(p, a, b):
    """
    Compute perpendicular distance from point p
    to line segment AB (meters)

    p, a, b are (lat, lng)
    """
    px, py = _to_xy(p)
    ax, ay = _to_xy(a)
    bx, by = _to_xy(b)

    dx = bx - ax
    dy = by - ay

    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)


    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))

    closest_x = ax + t * dx
    closest_y = ay + t * dy

    return math.hypot(px - closest_x, py - closest_y)
