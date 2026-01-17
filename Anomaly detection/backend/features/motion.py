import math
import numpy as np

def accel_magnitude(a):
    return math.sqrt(a[0]**2 + a[1]**2 + a[2]**2)

def gyro_magnitude(g):
    return math.sqrt(g[0]**2 + g[1]**2 + g[2]**2)

def variance(values):
    return np.var(values) if len(values) > 1 else 0
