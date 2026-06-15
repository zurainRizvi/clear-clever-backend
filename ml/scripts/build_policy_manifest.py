#!/usr/bin/env python3
"""Rebuild policy_manifest.json with features[] from backend policySeedData.ts."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from _shared import ML_ROOT

POLICY_SEED_PATH = os.path.join(
    ML_ROOT, "..", "clear-clever-backend", "src", "seed", "policySeedData.ts"
)
MANIFEST_PATH = os.path.join(ML_ROOT, "data", "policy_manifest.json")

ML_CATEGORIES = frozenset({"home", "auto", "life", "pet"})


def _parse_policies_from_ts(source: str) -> dict[str, dict[str, Any]]:
    """Extract slug, category, premiums, deductible, features from TypeScript seed."""
    policies: dict[str, dict[str, Any]] = {}
    blocks = re.split(r"\n  \{", source)
    for block in blocks:
        slug_match = re.search(r"slug: '([^']+)'", block)
        if not slug_match:
            continue
        slug = slug_match.group(1)
        category_match = re.search(r"category: '([^']+)'", block)
        if not category_match:
            continue
        category = category_match.group(1)
        if category not in ML_CATEGORIES:
            continue

        monthly_match = re.search(r"premiumMonthlyPkr: (\d+)", block)
        yearly_match = re.search(r"premiumYearlyPkr: (\d+)", block)
        deductible_match = re.search(r"deductiblePkr: (\d+)", block)
        features_match = re.search(r"features: \[(.*?)\]", block, re.DOTALL)
        features: list[str] = []
        if features_match:
            features = re.findall(r"'([^']+)'", features_match.group(1))

        policies[slug] = {
            "slug": slug,
            "category": category,
            "premiumMonthlyPkr": int(monthly_match.group(1)) if monthly_match else 0,
            "premiumYearlyPkr": int(yearly_match.group(1)) if yearly_match else 0,
            "featureCount": len(features),
            "deductiblePkr": int(deductible_match.group(1)) if deductible_match else 0,
            "features": features,
        }
    return policies


def main() -> None:
    with open(POLICY_SEED_PATH, encoding="utf-8") as fh:
        source = fh.read()

    parsed = _parse_policies_from_ts(source)
    if not parsed:
        raise SystemExit(f"No policies parsed from {POLICY_SEED_PATH}")

    ordered: list[dict[str, Any]] = []
    if os.path.isfile(MANIFEST_PATH):
        with open(MANIFEST_PATH, encoding="utf-8") as fh:
            existing = json.load(fh)
        for entry in existing:
            slug = entry["slug"]
            if slug in parsed:
                ordered.append(parsed[slug])
            else:
                entry.setdefault("features", [])
                entry["featureCount"] = len(entry["features"])
                ordered.append(entry)
    else:
        ordered = sorted(parsed.values(), key=lambda p: (p["category"], p["slug"]))

    missing = set(parsed) - {p["slug"] for p in ordered}
    for slug in sorted(missing):
        ordered.append(parsed[slug])

    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(ordered, fh, indent=2)
        fh.write("\n")

    with_features = sum(1 for p in ordered if p.get("features"))
    print(f"Wrote {len(ordered)} policies to {MANIFEST_PATH} ({with_features} with features[])")


if __name__ == "__main__":
    main()
