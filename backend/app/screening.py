"""
Environmental image screening – DEMONSTRATION HEURISTIC only.

This module does NOT use a trained machine-learning model.
It applies simple rule-based image statistics (colour channel ratios,
brightness, saturation) to produce an advisory signal.

IMPORTANT: This heuristic has NO measured accuracy, recall or precision.
It must never be used to certify that water is safe or unsafe.
All outputs are labelled DEMONSTRATION HEURISTIC.
"""
from __future__ import annotations
import io
import math
from typing import TypedDict

try:
    from PIL import Image, ImageStat
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


class ScreeningResult(TypedDict):
    signal: str          # ELEVATED | NORMAL | INDETERMINATE
    advisory: str        # Human-readable advisory
    method: str          # Always "DEMONSTRATION HEURISTIC"
    disclaimer: str
    details: dict


_DISCLAIMER = (
    "DEMONSTRATION HEURISTIC – Not a validated ML model. "
    "No measured accuracy. Must not be used to certify water quality."
)


def _analyse_image(img_bytes: bytes) -> ScreeningResult:
    if not PIL_AVAILABLE:
        return ScreeningResult(
            signal="INDETERMINATE",
            advisory="PIL not installed; image analysis unavailable.",
            method="DEMONSTRATION HEURISTIC",
            disclaimer=_DISCLAIMER,
            details={"error": "PIL not available"},
        )

    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        # Downsample for speed
        img.thumbnail((256, 256))
        stat = ImageStat.Stat(img)
        r_mean, g_mean, b_mean = stat.mean

        # Brown/murky index: high red+green relative to blue may indicate
        # sediment or bloom discolouration.
        total = r_mean + g_mean + b_mean
        if total < 1:
            total = 1.0

        r_ratio = r_mean / total
        g_ratio = g_mean / total
        b_ratio = b_mean / total

        # Low blue ratio may suggest turbid or discoloured water
        green_dominance = g_ratio - b_ratio
        # High brightness variance → choppy / foam
        brightness_stddev = stat.stddev[0]  # R channel std as proxy

        details = {
            "r_mean": round(r_mean, 2),
            "g_mean": round(g_mean, 2),
            "b_mean": round(b_mean, 2),
            "r_ratio": round(r_ratio, 3),
            "g_ratio": round(g_ratio, 3),
            "b_ratio": round(b_ratio, 3),
            "green_dominance": round(green_dominance, 3),
            "brightness_stddev": round(brightness_stddev, 2),
        }

        # Simple rule thresholds – entirely illustrative
        if green_dominance > 0.12 or (r_ratio > 0.38 and b_ratio < 0.28):
            signal = "ELEVATED"
            advisory = (
                "Image statistics suggest possible water discolouration "
                "(elevated green/red ratio relative to blue). "
                "Manual officer review is required."
            )
        elif brightness_stddev > 60:
            signal = "ELEVATED"
            advisory = (
                "High pixel variance detected (possible foam or turbulence). "
                "Manual officer review is required."
            )
        else:
            signal = "NORMAL"
            advisory = (
                "Image statistics are within baseline range. "
                "No visual anomaly detected by heuristic – officer review still recommended."
            )

        return ScreeningResult(
            signal=signal,
            advisory=advisory,
            method="DEMONSTRATION HEURISTIC",
            disclaimer=_DISCLAIMER,
            details=details,
        )

    except Exception as exc:  # noqa: BLE001
        return ScreeningResult(
            signal="INDETERMINATE",
            advisory=f"Image could not be parsed: {exc}",
            method="DEMONSTRATION HEURISTIC",
            disclaimer=_DISCLAIMER,
            details={"error": str(exc)},
        )


def screen_image(img_bytes: bytes) -> ScreeningResult:
    """Public entry point."""
    return _analyse_image(img_bytes)
