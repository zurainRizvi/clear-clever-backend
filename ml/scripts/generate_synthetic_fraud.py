#!/usr/bin/env python3
"""Generate synthetic fraud signal training data aligned to heuristic signal types."""

from __future__ import annotations

import argparse
import os
import random

import pandas as pd

from _shared import FRAUD_CATEGORIES, FRAUD_SIGNAL_TYPES, ML_ROOT

SEVERITY_LEVELS = ["low", "medium", "high", "critical"]
SEVERITY_ENCODED = {"low": 1, "medium": 2, "high": 3, "critical": 4}

CATEGORY_SIGNAL_BIAS: dict[str, list[str]] = {
    "account": ["duplicate_email", "unverified_provider", "inactive_spike"],
    "claims": ["claim_burst", "rejected_claims_volume"],
    "commerce": ["pending_purchases", "lead_spike"],
    "catalog": ["stale_pending_policies", "reject_rate"],
}

HIGH_ENTITY_SIGNALS = frozenset(
    {"duplicate_email", "claim_burst", "lead_spike", "rejected_claims_volume", "pending_purchases"}
)
YOUNG_ACCOUNT_CATEGORIES = frozenset({"account", "commerce"})


def _sample_account_age(rng: random.Random, fraud_category: str) -> int:
    """Younger accounts correlate with account/commerce fraud tabs."""
    if fraud_category in YOUNG_ACCOUNT_CATEGORIES:
        return rng.choices(
            list(range(1, 901)),
            weights=[8 if d <= 30 else 4 if d <= 90 else 2 if d <= 180 else 1 for d in range(1, 901)],
        )[0]
    return rng.randint(1, 900)


def _sample_entity_count(rng: random.Random, signal_type: str, severity: str) -> int:
    """Burst and high-severity signals correlate with higher entity counts."""
    if signal_type in HIGH_ENTITY_SIGNALS or severity in ("high", "critical"):
        return rng.randint(8, 30)
    if signal_type in ("inactive_spike", "reject_rate", "stale_pending_policies"):
        return rng.randint(4, 18)
    return rng.randint(1, 12)


def _sample_severity(rng: random.Random, signal_type: str) -> str:
    if signal_type in HIGH_ENTITY_SIGNALS:
        return rng.choices(SEVERITY_LEVELS, weights=[10, 25, 40, 25])[0]
    return rng.choice(SEVERITY_LEVELS)


def synthetic_row(rng: random.Random, row_id: int) -> dict:
    fraud_category = rng.choice(FRAUD_CATEGORIES)
    biased_types = CATEGORY_SIGNAL_BIAS[fraud_category]
    signal_type = rng.choices(
        FRAUD_SIGNAL_TYPES,
        weights=[3 if t in biased_types else 1 for t in FRAUD_SIGNAL_TYPES],
    )[0]
    severity = _sample_severity(rng, signal_type)
    severity_encoded = SEVERITY_ENCODED[severity]
    account_age_days = _sample_account_age(rng, fraud_category)
    related_entity_count = _sample_entity_count(rng, signal_type, severity)

    fraudulent = 0
    if signal_type in ("duplicate_email", "claim_burst", "lead_spike"):
        fraudulent = 1
    if severity in ("high", "critical"):
        fraudulent = 1
    if related_entity_count >= 12:
        fraudulent = 1
    if account_age_days <= 30 and signal_type == "duplicate_email":
        fraudulent = 1
    if rng.random() < 0.08:
        fraudulent = 1 - fraudulent

    return {
        "id": row_id,
        "signal_type": signal_type,
        "fraud_category": fraud_category,
        "severity": severity,
        "severity_encoded": severity_encoded,
        "account_age_days": account_age_days,
        "related_entity_count": related_entity_count,
        "fraudulent": fraudulent,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument(
        "--out",
        default=os.path.join(ML_ROOT, "data", "synthetic", "fraud_train.csv"),
    )
    args = parser.parse_args()
    rng = random.Random(args.seed)

    rows = [synthetic_row(rng, i) for i in range(args.rows)]
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(args.out, index=False)
    pos = int(df["fraudulent"].sum())
    print(f"Wrote {len(df)} rows to {args.out} (fraudulent={pos}, {pos/len(df):.1%})")


if __name__ == "__main__":
    main()
