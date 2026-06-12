from math import radians, sin, cos, sqrt, atan2
from typing import List, Dict, Any

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """
    Calculate the great-circle distance between two points on the Earth's surface
    using the Haversine formula. Returns distance in meters (rounded to nearest integer).
    """
    R = 6371000.0  # Radius of Earth in meters

    phi1 = radians(lat1)
    phi2 = radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lon2 - lon1)

    a = (sin(delta_phi / 2.0) ** 2 +
         cos(phi1) * cos(phi2) * (sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))

    return int(round(R * c))

def build_distance_matrix(points: List[Dict[str, float]]) -> List[List[int]]:
    """
    Build a 2D distance matrix (symmetric) for all given coordinate points.
    points[0] is typically the depot.
    """
    n = len(points)
    matrix = [[0] * n for _ in range(n)]

    for i in range(n):
        for j in range(i, n):
            if i == j:
                matrix[i][j] = 0
            else:
                dist = haversine(
                    points[i]["lat"], points[i]["lng"],
                    points[j]["lat"], points[j]["lng"]
                )
                matrix[i][j] = dist
                matrix[j][i] = dist

    return matrix
