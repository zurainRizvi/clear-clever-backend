"""Shared constants for ClearClever ML scripts."""

from __future__ import annotations

CLAIM_TYPES = [
    "accident",
    "theft",
    "damage",
    "medical",
    "pet_care",
    "home",
    "auto",
    "life",
    "pet",
    "other",
]

POLICY_CATEGORIES = ["home", "auto", "life", "pet", "others"]

CITY_REGIONS = ["punjab", "sindh", "kpk", "balochistan", "islamabad", "other"]

CITY_TO_REGION = {
    "lahore": "punjab",
    "faisalabad": "punjab",
    "rawalpindi": "punjab",
    "multan": "punjab",
    "gujranwala": "punjab",
    "sialkot": "punjab",
    "karachi": "sindh",
    "hyderabad": "sindh",
    "sukkur": "sindh",
    "peshawar": "kpk",
    "abbottabad": "kpk",
    "mardan": "kpk",
    "quetta": "balochistan",
    "islamabad": "islamabad",
}

CLAIM_RISK_NUMERIC = [
    "estimated_amount_pkr",
    "description_length",
    "days_incident_to_submit",
    "amount_to_premium_ratio",
    "user_claims_7d",
    "user_claims_30d",
    "user_rejected_claims",
]

CLAIM_RISK_CATEGORICAL = {
    "claim_type": CLAIM_TYPES,
    "policy_category": POLICY_CATEGORIES,
    "city_region": CITY_REGIONS,
}

import os

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_ROOT = os.path.dirname(_SCRIPT_DIR)
REPO_ROOT = os.path.dirname(ML_ROOT)

_monorepo_backend_artifacts = os.path.join(
    REPO_ROOT, "clear-clever-backend", "src", "ml", "artifacts"
)
_standalone_backend_artifacts = os.path.join(REPO_ROOT, "src", "ml", "artifacts")

if os.path.isdir(_standalone_backend_artifacts):
    BACKEND_ARTIFACTS = _standalone_backend_artifacts
elif os.path.isdir(_monorepo_backend_artifacts):
    BACKEND_ARTIFACTS = _monorepo_backend_artifacts
else:
    BACKEND_ARTIFACTS = _standalone_backend_artifacts


def bucket_city(city: str | None) -> str:
    if not city:
        return "other"
    key = str(city).strip().lower()
    return CITY_TO_REGION.get(key, "other")


def one_hot_columns() -> list[str]:
    cols: list[str] = []
    for field, values in CLAIM_RISK_CATEGORICAL.items():
        for value in values:
            cols.append(f"{field}__{value}")
    return cols


def feature_order() -> list[str]:
    return CLAIM_RISK_NUMERIC + one_hot_columns()


FRAUD_SIGNAL_TYPES = [
    "duplicate_email",
    "unverified_provider",
    "inactive_spike",
    "claim_burst",
    "rejected_claims_volume",
    "pending_purchases",
    "lead_spike",
    "stale_pending_policies",
    "reject_rate",
    "other",
]

FRAUD_CATEGORIES = ["account", "claims", "commerce", "catalog"]

FRAUD_NUMERIC = [
    "severity_encoded",
    "account_age_days",
    "related_entity_count",
]

FRAUD_CATEGORICAL = {
    "signal_type": FRAUD_SIGNAL_TYPES,
    "fraud_category": FRAUD_CATEGORIES,
}


def fraud_one_hot_columns() -> list[str]:
    cols: list[str] = []
    for field, values in FRAUD_CATEGORICAL.items():
        for value in values:
            cols.append(f"{field}__{value}")
    return cols


def fraud_feature_order() -> list[str]:
    return FRAUD_NUMERIC + fraud_one_hot_columns()


RANKER_NUMERIC = [
    "user_value_pkr",
    "policy_premium_monthly_pkr",
    "policy_feature_count",
    "policy_deductible_pkr",
    "premium_to_value_ratio",
]

RANKER_CATEGORICAL_BY_CATEGORY = {
    "home": {
        "city_region": CITY_REGIONS,
        "property_type": [
            "Apartment",
            "Independent house",
            "Villa",
            "Commercial unit",
            "other",
        ],
        "occupancy": [
            "Owner occupied",
            "Rented out",
            "Vacant / under construction",
            "other",
        ],
    },
    "auto": {
        "city_region": CITY_REGIONS,
        "vehicle_type": [
            "Private car",
            "SUV / 4x4",
            "Motorcycle",
            "Commercial vehicle",
            "other",
        ],
        "coverage_type": [
            "Comprehensive",
            "Third-party liability",
            "Theft protection",
            "Accidental damage",
            "Roadside assistance",
            "other",
        ],
    },
    "life": {
        "city_region": CITY_REGIONS,
        "coverage_goal": [
            "Family income protection",
            "Children education fund",
            "Mortgage / loan protection",
            "Retirement planning",
            "other",
        ],
        "age_band": ["18–30", "31–40", "41–50", "51–60", "60+", "other"],
    },
    "pet": {
        "city_region": CITY_REGIONS,
        "pet_type": ["Dog", "Cat", "Bird", "Other pet", "other"],
        "vaccination_status": [
            "Fully vaccinated",
            "Partially vaccinated",
            "Not vaccinated yet",
            "other",
        ],
    },
}


def ranker_feature_order(category: str) -> list[str]:
    categorical = RANKER_CATEGORICAL_BY_CATEGORY[category]
    cols: list[str] = list(RANKER_NUMERIC)
    for field, values in categorical.items():
        for value in values:
            cols.append(f"{field}__{value}")
    return cols
