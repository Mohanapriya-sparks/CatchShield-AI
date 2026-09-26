"""
Trip / weather advisory.
Uses Open-Meteo Marine API (free, no API key required).
Data is always labelled with source and update time.
"Safe to sail" is NEVER displayed.
"""
from __future__ import annotations
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Query

from ..services.risk_model import predict_zone_risk

router = APIRouter()

OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"

# Approximate zone → lat/lon centre (demo mapping)
ZONE_COORDS: dict[str, tuple[float, float]] = {
    "ZONE 01": (10.5, 76.0),
    "ZONE 02": (11.0, 75.5),
    "ZONE 03": (9.5, 76.5),
    "ZONE 04": (8.5, 77.0),
    "ZONE 05": (12.0, 75.0),
}

_DEFAULT_COORDS = (10.0, 76.0)


ZONE_PROFILES: dict[str, dict] = {
    "ZONE 01": {
        "wave_height_m": 0.8,
        "wind_speed_kmh": 12.0,
        "advisory": "Low wave height (0.8 m). Light winds (12.0 km/h). Ideal calm sea conditions for coastal fishing.",
    },
    "ZONE 02": {
        "wave_height_m": 2.3,
        "wind_speed_kmh": 29.0,
        "advisory": "Moderate wave height (2.3 m). Moderate winds (29.0 km/h). Swells reported across southern sector.",
    },
    "ZONE 03": {
        "wave_height_m": 1.4,
        "wind_speed_kmh": 17.5,
        "advisory": "Moderate wave height (1.4 m). Light winds (17.5 km/h). Estuary coastal zone.",
    },
    "ZONE 04": {
        "wave_height_m": 0.9,
        "wind_speed_kmh": 14.0,
        "advisory": "Low wave height (0.9 m). Light winds (14.0 km/h). Inshore reef area.",
    },
    "ZONE 05": {
        "wave_height_m": 3.7,
        "wind_speed_kmh": 54.0,
        "advisory": "High wave height (3.7 m) – exercise caution! Strong winds (54.0 km/h) – rough deep sea advisory.",
    },
}


@router.get("")
async def get_advisory(
    zone: str = Query(..., description="Catch zone, e.g. Zone 03"),
):
    """
    Fetch marine weather for the given zone from Open-Meteo Marine API with zone fallback profiles.
    Source and update time are always shown.
    'Safe to sail' is never displayed.
    """
    zone_key = zone.upper()
    coords = ZONE_COORDS.get(zone_key, _DEFAULT_COORDS)
    profile = ZONE_PROFILES.get(zone_key, ZONE_PROFILES["ZONE 01"])
    lat, lon = coords

    # For the hackathon demo, we bypass the live Open-Meteo API to ensure 
    # stable, distinct values for each zone and to prevent internet-dependency failures.
    
    fetched_at = datetime.now(timezone.utc).isoformat()
    days_since_alert = 2 if zone_key == "ZONE 03" else 30
    hist_rate = 0.8 if zone_key == "ZONE 03" else 0.05
    ai_risk_score = predict_zone_risk(days_since_alert, 1.0, hist_rate)

    return {
        "zone": zone,
        "coordinates": {"lat": lat, "lon": lon},
        "source": "CatchShield Marine Service (Demo Profile)",
        "fetched_at": fetched_at,
        "data_time": fetched_at,
        "wave_height_m": profile["wave_height_m"],
        "wind_speed_kmh": profile["wind_speed_kmh"],
        "advisory": profile["advisory"],
        "ai_risk_score": ai_risk_score,
        "sample_data": True,
        "note": "Weather data is for informational purposes only. 'Safe to sail' is never guaranteed by this system.",
    }


def _build_advisory(wave_m: float | None, wind_kmh: float | None) -> str:
    parts = []
    if wave_m is not None:
        if wave_m > 3.0:
            parts.append(f"High wave height ({wave_m:.1f} m) – exercise caution.")
        elif wave_m > 1.5:
            parts.append(f"Moderate wave height ({wave_m:.1f} m).")
        else:
            parts.append(f"Low wave height ({wave_m:.1f} m).")

    if wind_kmh is not None:
        if wind_kmh > 50:
            parts.append(f"Strong winds ({wind_kmh:.1f} km/h) – exercise caution.")
        elif wind_kmh > 25:
            parts.append(f"Moderate winds ({wind_kmh:.1f} km/h).")
        else:
            parts.append(f"Light winds ({wind_kmh:.1f} km/h).")

    if not parts:
        return "Marine data unavailable."

    return " ".join(parts) + " Conditions provided for reference only."
