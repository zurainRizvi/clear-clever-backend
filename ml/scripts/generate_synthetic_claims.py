#!/usr/bin/env python3
"""Generate semi-synthetic claim risk training data aligned to ClearClever schema."""

from __future__ import annotations

import argparse
import os
import random

import numpy as np
import pandas as pd

from _shared import (
    CLAIM_RISK_CATEGORICAL,
    CLAIM_TYPES,
    CITY_TO_REGION,
    ML_ROOT,
    bucket_city,
)

CITIES = list(CITY_TO_REGION.keys())
DESCRIPTIONS = [
    "Water damage from burst pipe in kitchen — requesting assessment.",
    "Rear bumper damage from parking lot incident.",
    "Emergency vet surgery — partner clinic invoice attached.",
    "Stolen laptop from home office — police report filed.",
    "Windshield crack on motorway near Islamabad.",
    "Hospital admission after road accident — medical bills enclosed.",
    "Fire damage to kitchen wiring — electrician report available.",
    "Repeated claim within same week — urgent review requested.",
]

# Lognormal (mu, sigma) per claim type — realistic amount bands
CLAIM_TYPE_AMOUNT_PARAMS: dict[str, tuple[float, float]] = {
    "accident": (10.3, 0.75),
    "theft": (9.8, 0.85),
    "damage": (10.1, 0.8),
    "medical": (10.9, 0.9),
    "pet_care": (9.4, 0.65),
    "home": (10.5, 0.85),
    "auto": (10.2, 0.7),
    "life": (11.0, 0.95),
    "pet": (9.3, 0.6),
    "other": (10.0, 0.9),
}

CLAIM_TYPE_POLICY_BIAS: dict[str, list[str]] = {
    "accident": ["auto", "life"],
    "theft": ["home", "auto"],
    "damage": ["home", "auto"],
    "medical": ["life", "auto"],
    "pet_care": ["pet"],
    "home": ["home"],
    "auto": ["auto"],
    "life": ["life"],
    "pet": ["pet"],
    "other": ["home", "auto", "life", "pet", "others"],
}


def _estimated_amount(rng: random.Random, claim_type: str) -> int:
    mu, sigma = CLAIM_TYPE_AMOUNT_PARAMS.get(claim_type, (10.5, 0.9))
    estimated = int(rng.lognormvariate(mu, sigma))
    return max(5000, min(estimated, 2_500_000))


def _days_incident(rng: random.Random, estimated: int) -> int:
    """Higher claim amounts correlate with slightly longer reporting delays."""
    if estimated > 800_000:
        return rng.randint(10, 45)
    if estimated > 200_000:
        return rng.randint(5, 35)
    return rng.randint(0, 30)


def _user_claim_counts(rng: random.Random) -> tuple[int, int, int]:
    """Correlate burst activity with prior rejections."""
    user_claims_7d = rng.choices([0, 1, 2, 3, 4], weights=[55, 25, 12, 5, 3])[0]
    user_claims_30d = user_claims_7d + rng.randint(0, 6)
    if user_claims_7d >= 3:
        user_rejected = rng.choices([0, 1, 2, 3], weights=[20, 25, 30, 25])[0]
    elif user_claims_7d >= 2:
        user_rejected = rng.choices([0, 1, 2, 3], weights=[45, 30, 15, 10])[0]
    else:
        user_rejected = rng.choices([0, 1, 2, 3], weights=[70, 18, 8, 4])[0]
    return user_claims_7d, user_claims_30d, user_rejected


def _compute_high_risk(
    user_claims_7d: int,
    ratio: float,
    days_incident: int,
    estimated: int,
    policy_category: str,
    user_rejected: int,
) -> int:
    """Label from inference-time features only (no post-hoc status)."""
    high_risk = 0
    if user_claims_7d >= 3:
        high_risk = 1
    if ratio > 80:
        high_risk = 1
    if days_incident > 30:
        high_risk = 1
    if estimated > 500_000 and policy_category == "pet":
        high_risk = 1
    if user_rejected >= 2:
        high_risk = 1
    return high_risk


def _derive_status(rng: random.Random, high_risk: int) -> str:
    """Synthetic outcome metadata — not used as a model feature."""
    if high_risk:
        return rng.choices(
            ["rejected", "in_review", "submitted"],
            weights=[55, 30, 15],
        )[0]
    return rng.choices(
        ["approved", "submitted", "in_review"],
        weights=[70, 20, 10],
    )[0]


def synthetic_row(rng: random.Random, row_id: int) -> dict:
    claim_type = rng.choice(CLAIM_TYPES)
    biased_categories = CLAIM_TYPE_POLICY_BIAS.get(claim_type, ["home", "auto", "life", "pet", "others"])
    policy_category = rng.choice(biased_categories)
    city = rng.choice(CITIES)
    city_region = bucket_city(city)
    premium = rng.randint(1500, 25000)
    estimated = _estimated_amount(rng, claim_type)
    days_incident = _days_incident(rng, estimated)
    description = rng.choice(DESCRIPTIONS)
    user_claims_7d, user_claims_30d, user_rejected = _user_claim_counts(rng)
    ratio = estimated / max(premium, 1)

    high_risk = _compute_high_risk(
        user_claims_7d, ratio, days_incident, estimated, policy_category, user_rejected
    )
    if rng.random() < 0.08:
        high_risk = 1 - high_risk

    status = _derive_status(rng, high_risk)

    return {
        "id": row_id,
        "claim_type": claim_type,
        "policy_category": policy_category,
        "city": city,
        "city_region": city_region,
        "estimated_amount_pkr": estimated,
        "description_length": len(description),
        "days_incident_to_submit": days_incident,
        "amount_to_premium_ratio": round(ratio, 4),
        "user_claims_7d": user_claims_7d,
        "user_claims_30d": user_claims_30d,
        "user_rejected_claims": user_rejected,
        "status": status,
        "high_risk": high_risk,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--out",
        default=os.path.join(ML_ROOT, "data", "synthetic", "claims_train.csv"),
    )
    args = parser.parse_args()

    rng = random.Random(args.seed)
    np.random.seed(args.seed)
    rows = [synthetic_row(rng, i) for i in range(args.rows)]
    df = pd.DataFrame(rows)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    df.to_csv(args.out, index=False)
    pos = int(df["high_risk"].sum())
    print(f"Wrote {len(df)} rows to {args.out} (high_risk={pos}, {pos/len(df):.1%})")
    print("Categories:", {k: len(v) for k, v in CLAIM_RISK_CATEGORICAL.items()})


if __name__ == "__main__":
    main()
