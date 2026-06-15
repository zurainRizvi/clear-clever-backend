#!/usr/bin/env python3
"""Generate synthetic policy-ranking training rows (user + policy pairs)."""

from __future__ import annotations

import argparse
import json
import os
import random
from typing import Any

import pandas as pd

from _shared import ML_ROOT, RANKER_CATEGORICAL_BY_CATEGORY, bucket_city

MANIFEST_PATH = os.path.join(ML_ROOT, "data", "policy_manifest.json")

WEIGHTS = {"affordability": 40, "coverage_fit": 35, "feature_richness": 25}

CATEGORY_ANSWER_POOLS: dict[str, dict[str, list[Any]]] = {
    "home": {
        "property_type": ["Apartment", "Independent house", "Villa", "Commercial unit"],
        "occupancy": ["Owner occupied", "Rented out", "Vacant / under construction"],
        "city": ["Karachi", "Lahore", "Islamabad", "Multan", "Peshawar"],
        "property_value_pkr": (2_000_000, 25_000_000),
    },
    "auto": {
        "vehicle_type": ["Private car", "SUV / 4x4", "Motorcycle", "Commercial vehicle"],
        "coverage_type": [
            ["Comprehensive"],
            ["Third-party liability"],
            ["Comprehensive", "Theft protection"],
            ["Accidental damage", "Roadside assistance"],
        ],
        "registration_city": ["Karachi", "Lahore", "Islamabad / Rawalpindi", "Other"],
        "vehicle_value_pkr": (400_000, 8_000_000),
        "vehicle_year": (2012, 2025),
    },
    "life": {
        "coverage_goal": [
            "Family income protection",
            "Children education fund",
            "Mortgage / loan protection",
            "Retirement planning",
        ],
        "age_band": ["18–30", "31–40", "41–50", "51–60", "60+"],
        "annual_income_pkr": (600_000, 12_000_000),
        "city": ["Karachi", "Lahore", "Islamabad", "Faisalabad"],
    },
    "pet": {
        "pet_type": ["Dog", "Cat", "Bird", "Other pet"],
        "vaccination_status": [
            "Fully vaccinated",
            "Partially vaccinated",
            "Not vaccinated yet",
        ],
        "city": ["Karachi", "Lahore", "Islamabad", "Rawalpindi"],
        "pet_age_years": (0, 14),
        "pet_weight_kg": (2, 45),
    },
}

NUMERIC_ANSWER_FIELDS = frozenset(
    {
        "property_value_pkr",
        "vehicle_value_pkr",
        "vehicle_year",
        "annual_income_pkr",
        "pet_age_years",
        "pet_weight_kg",
    }
)


def load_manifest() -> list[dict[str, Any]]:
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def user_value_pkr(category: str, answers: dict[str, Any]) -> float:
    if category == "home":
        return float(answers.get("property_value_pkr", 3_000_000))
    if category == "auto":
        return float(answers.get("vehicle_value_pkr", 1_500_000))
    if category == "life":
        return float(answers.get("annual_income_pkr", 1_200_000))
    return float(answers.get("pet_weight_kg", 10) * 50_000)


def user_city(category: str, answers: dict[str, Any]) -> str:
    if category == "auto":
        city = str(answers.get("registration_city", "Karachi"))
        if city == "Islamabad / Rawalpindi":
            return "Islamabad"
        if city == "Other":
            return "Lahore"
        return city
    return str(answers.get("city", "Karachi"))


def answer_tokens(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v).lower().strip() for v in value if str(v).strip()]
    if value is None:
        return []
    text = str(value).strip().lower()
    return [text] if text else []


def single_choice_bonus(policy: dict[str, Any], answers: dict[str, Any]) -> float:
    """Port of recommendationService.ts singleChoiceBonus — questionnaire–policy alignment."""
    features = policy.get("features") or []
    if not features:
        return 0.0
    feature_lower = [f.lower() for f in features]
    bonus = 0.0
    for field, answer in answers.items():
        if field in NUMERIC_ANSWER_FIELDS:
            continue
        for token in answer_tokens(answer):
            first_word = token.split(" ")[0] if token else ""
            if not first_word:
                continue
            if any(first_word in feature for feature in feature_lower):
                bonus += 2.0
                break
    return min(bonus, 5.0)


def coverage_fit_score(policy: dict[str, Any], user_value: float) -> float:
    if user_value <= 0:
        return WEIGHTS["coverage_fit"] * 0.5
    ratio = policy["premiumYearlyPkr"] / user_value
    if 0.008 <= ratio <= 0.025:
        return float(WEIGHTS["coverage_fit"])
    distance = (0.008 - ratio) if ratio < 0.008 else (ratio - 0.025) if ratio > 0.025 else 0.0
    penalty = min(distance * 400, WEIGHTS["coverage_fit"])
    return max(WEIGHTS["coverage_fit"] - penalty, 0.0)


def rule_score(
    policy: dict[str, Any],
    policies: list[dict[str, Any]],
    user_value: float,
    answers: dict[str, Any],
) -> float:
    premiums = [p["premiumMonthlyPkr"] for p in policies]
    max_premium = max(premiums)
    min_premium = min(premiums)
    max_features = max(p["featureCount"] for p in policies) or 1

    if max_premium == min_premium:
        affordability = WEIGHTS["affordability"]
    else:
        affordability = (
            (max_premium - policy["premiumMonthlyPkr"]) / (max_premium - min_premium)
        ) * WEIGHTS["affordability"]

    coverage = coverage_fit_score(policy, user_value)
    richness = (policy["featureCount"] / max_features) * WEIGHTS["feature_richness"]
    bonus = single_choice_bonus(policy, answers)
    return round(affordability + coverage + richness + bonus)


def random_answers(category: str, rng: random.Random) -> dict[str, Any]:
    pool = CATEGORY_ANSWER_POOLS[category]
    answers: dict[str, Any] = {}
    for key, values in pool.items():
        if isinstance(values, tuple) and len(values) == 2:
            answers[key] = rng.randint(values[0], values[1])
        elif isinstance(values[0], list):
            answers[key] = rng.choice(values)
        else:
            answers[key] = rng.choice(values)
    return answers


def encode_row(
    category: str,
    answers: dict[str, Any],
    policy: dict[str, Any],
    label: int,
) -> dict[str, Any]:
    user_value = user_value_pkr(category, answers)
    city = user_city(category, answers)
    city_region = bucket_city(city)
    ratio = policy["premiumYearlyPkr"] / max(user_value, 1)

    row: dict[str, Any] = {
        "category": category,
        "policy_slug": policy["slug"],
        "label": label,
        "user_value_pkr": user_value,
        "policy_premium_monthly_pkr": policy["premiumMonthlyPkr"],
        "policy_feature_count": policy["featureCount"],
        "policy_deductible_pkr": policy["deductiblePkr"],
        "premium_to_value_ratio": round(ratio, 6),
        "city_region": city_region,
    }

    categorical = RANKER_CATEGORICAL_BY_CATEGORY[category]
    for field in categorical:
        if field == "city_region":
            row["city_region"] = city_region
            continue
        raw = answers.get(field)
        if isinstance(raw, list):
            row[field] = raw[0] if raw else "other"
        else:
            row[field] = raw if raw is not None else "other"

    return row


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--journeys", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=99)
    parser.add_argument(
        "--out",
        default=os.path.join(ML_ROOT, "data", "synthetic", "recommendations_train.csv"),
    )
    args = parser.parse_args()
    rng = random.Random(args.seed)

    manifest = load_manifest()
    by_category: dict[str, list[dict[str, Any]]] = {}
    for policy in manifest:
        by_category.setdefault(policy["category"], []).append(policy)

    rows: list[dict[str, Any]] = []
    for category in ("home", "auto", "life", "pet"):
        policies = by_category.get(category, [])
        if not policies:
            continue

        journeys = max(args.journeys // 4, 400)
        for _ in range(journeys):
            answers = random_answers(category, rng)
            user_value = user_value_pkr(category, answers)
            scored = sorted(
                policies,
                key=lambda p: rule_score(p, policies, user_value, answers),
                reverse=True,
            )
            positive = scored[0]["slug"]
            if len(scored) > 1 and rng.random() < 0.15:
                positive = scored[1]["slug"]

            for policy in policies:
                label = 1 if policy["slug"] == positive else 0
                rows.append(encode_row(category, answers, policy, label))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    pd.DataFrame(rows).to_csv(args.out, index=False)
    positives = sum(1 for r in rows if r["label"] == 1)
    print(f"Wrote {len(rows)} rows ({positives} positives) to {args.out}")


if __name__ == "__main__":
    main()
