#!/usr/bin/env python3
"""Export anonymized MlTrainingSnapshot rows from Atlas into production CSVs."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

import pandas as pd
from pymongo import MongoClient

from _shared import (
    CLAIM_RISK_CATEGORICAL,
    CLAIM_RISK_NUMERIC,
    FRAUD_CATEGORICAL,
    FRAUD_NUMERIC,
    ML_ROOT,
    RANKER_CATEGORICAL_BY_CATEGORY,
    RANKER_NUMERIC,
)

PRODUCTION_DIR = os.path.join(ML_ROOT, "data", "production")
REPORTS_DIR = os.path.join(ML_ROOT, "reports", "production")

CLAIM_COLUMNS = (
    ["id"]
    + ["claim_type", "policy_category", "city_region"]
    + CLAIM_RISK_NUMERIC
    + ["status", "high_risk"]
)

FRAUD_COLUMNS = ["id"] + list(FRAUD_CATEGORICAL.keys()) + FRAUD_NUMERIC + ["fraudulent"]

RANKER_BASE_COLUMNS = [
    "category",
    "policy_slug",
    "label",
    "user_value_pkr",
    "policy_premium_monthly_pkr",
    "policy_feature_count",
    "policy_deductible_pkr",
    "premium_to_value_ratio",
    "city_region",
]


def connect(uri: str) -> MongoClient:
    return MongoClient(uri, serverSelectionTimeoutMS=15000)


def claim_row(doc: dict, index: int) -> dict:
    features = doc.get("features") or {}
    label = int(doc.get("label", 0))
    return {
        "id": f"prod-claim-{index}",
        "claim_type": features.get("claim_type", "other"),
        "policy_category": features.get("policy_category", "others"),
        "city_region": features.get("city_region", "other"),
        "estimated_amount_pkr": float(features.get("estimated_amount_pkr", 0)),
        "description_length": int(features.get("description_length", 0)),
        "days_incident_to_submit": int(features.get("days_incident_to_submit", 0)),
        "amount_to_premium_ratio": float(features.get("amount_to_premium_ratio", 0)),
        "user_claims_7d": int(features.get("user_claims_7d", 0)),
        "user_claims_30d": int(features.get("user_claims_30d", 0)),
        "user_rejected_claims": int(features.get("user_rejected_claims", 0)),
        "status": "rejected" if label == 1 else "approved",
        "high_risk": label,
    }


def fraud_row(doc: dict, index: int) -> dict:
    features = doc.get("features") or {}
    label = int(doc.get("label", 0))
    severity = int(features.get("severity_encoded", 2))
    severity_label = {1: "low", 2: "medium", 3: "high", 4: "critical"}.get(severity, "medium")
    return {
        "id": f"prod-fraud-{index}",
        "signal_type": features.get("signal_type", "other"),
        "fraud_category": features.get("fraud_category", "account"),
        "severity": severity_label,
        "severity_encoded": severity,
        "account_age_days": int(features.get("account_age_days", 30)),
        "related_entity_count": int(features.get("related_entity_count", 1)),
        "fraudulent": label,
    }


def ranker_row(doc: dict, index: int) -> dict:
    features = doc.get("features") or {}
    category = str(features.get("category") or doc.get("category") or "home")
    row = {
        "category": category,
        "policy_slug": f"prod-policy-{index}",
        "label": int(doc.get("label", 1)),
        "user_value_pkr": float(features.get("user_value_pkr", 0)),
        "policy_premium_monthly_pkr": float(features.get("policy_premium_monthly_pkr", 0)),
        "policy_feature_count": int(features.get("policy_feature_count", 0)),
        "policy_deductible_pkr": float(features.get("policy_deductible_pkr", 0)),
        "premium_to_value_ratio": float(features.get("premium_to_value_ratio", 0)),
        "city_region": features.get("city_region", "other"),
    }
    categorical = RANKER_CATEGORICAL_BY_CATEGORY.get(category, {})
    for field in categorical:
        row[field] = features.get(field, "other")
    return row


def export_snapshots(uri: str, since_iso: str | None = None) -> dict:
    client = connect(uri)
    db = client.get_default_database()
    collection = db["mltrainingsnapshots"]

    query: dict = {"source": "production"}
    if since_iso:
        query["capturedAt"] = {"$gte": datetime.fromisoformat(since_iso.replace("Z", "+00:00"))}

    docs = list(collection.find(query).sort("capturedAt", 1))
    claim_rows = []
    fraud_rows = []
    ranker_rows = []

    claim_index = 0
    fraud_index = 0
    ranker_index = 0

    for doc in docs:
        domain = doc.get("domain")
        if domain == "claim_risk":
            claim_rows.append(claim_row(doc, claim_index))
            claim_index += 1
        elif domain == "fraud":
            fraud_rows.append(fraud_row(doc, fraud_index))
            fraud_index += 1
        elif domain == "policy_ranker":
            ranker_rows.append(ranker_row(doc, ranker_index))
            ranker_index += 1

    os.makedirs(PRODUCTION_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    claims_path = os.path.join(PRODUCTION_DIR, "claims_train.csv")
    fraud_path = os.path.join(PRODUCTION_DIR, "fraud_train.csv")
    ranker_path = os.path.join(PRODUCTION_DIR, "recommendations_train.csv")

    pd.DataFrame(claim_rows, columns=CLAIM_COLUMNS).to_csv(claims_path, index=False)
    pd.DataFrame(fraud_rows, columns=FRAUD_COLUMNS).to_csv(fraud_path, index=False)

    ranker_columns = list(RANKER_BASE_COLUMNS)
    for category in ("home", "auto", "life", "pet"):
        for field in RANKER_CATEGORICAL_BY_CATEGORY[category]:
            if field not in ranker_columns:
                ranker_columns.append(field)
    pd.DataFrame(ranker_rows, columns=ranker_columns).to_csv(ranker_path, index=False)

    summary = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "since": since_iso,
        "counts": {
            "claim_risk": len(claim_rows),
            "fraud": len(fraud_rows),
            "policy_ranker": len(ranker_rows),
            "total": len(docs),
        },
        "paths": {
            "claims": claims_path,
            "fraud": fraud_path,
            "recommendations": ranker_path,
        },
    }

    summary_path = os.path.join(REPORTS_DIR, "export_summary.json")
    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    print(json.dumps(summary, indent=2))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mongodb-uri", default=os.environ.get("MONGODB_URI"))
    parser.add_argument("--since", default=None, help="ISO timestamp watermark")
    args = parser.parse_args()

    if not args.mongodb_uri:
        raise SystemExit("MONGODB_URI is required")

    export_snapshots(args.mongodb_uri, args.since)


if __name__ == "__main__":
    main()
