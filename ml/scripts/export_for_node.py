#!/usr/bin/env python3
"""Train tabular models and export JSON artifacts for Node inference."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from datetime import datetime, timezone

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from _shared import (
    BACKEND_ARTIFACTS,
    CLAIM_RISK_CATEGORICAL,
    CLAIM_RISK_NUMERIC,
    FRAUD_CATEGORICAL,
    FRAUD_NUMERIC,
    ML_ROOT,
    RANKER_CATEGORICAL_BY_CATEGORY,
    RANKER_NUMERIC,
    feature_order,
    fraud_feature_order,
    ranker_feature_order,
)


BASELINE_DIR = os.path.join(ML_ROOT, "reports", "baseline")
PRODUCTION_DIR = os.path.join(ML_ROOT, "data", "production")
METRIC_KEYS = ("accuracy", "roc_auc", "precision", "recall", "f1", "train_rows", "test_rows")


def build_metrics(
    y_test: pd.Series,
    preds: np.ndarray,
    probs: np.ndarray,
    cm: np.ndarray,
    train_rows: int,
    test_rows: int,
) -> dict:
    report = classification_report(y_test, preds, output_dict=True)
    return {
        "accuracy": float(accuracy_score(y_test, preds)),
        "roc_auc": float(roc_auc_score(y_test, probs)),
        "precision": float(report["1"]["precision"]),
        "recall": float(report["1"]["recall"]),
        "f1": float(report["1"]["f1-score"]),
        "train_rows": train_rows,
        "test_rows": test_rows,
        "confusion_matrix": cm.tolist(),
    }


def snapshot_baseline(reports_dir: str) -> None:
    """Preserve pre-retrain metrics before overwriting."""
    os.makedirs(BASELINE_DIR, exist_ok=True)
    for name in (
        "claim_risk_metrics.json",
        "fraud_metrics.json",
        "policy_ranker_home_metrics.json",
        "policy_ranker_auto_metrics.json",
        "policy_ranker_life_metrics.json",
        "policy_ranker_pet_metrics.json",
    ):
        src = os.path.join(reports_dir, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(BASELINE_DIR, name))
    artifacts_dir = BACKEND_ARTIFACTS
    for name in (
        "claim_risk_v1.meta.json",
        "fraud_v1.meta.json",
        "policy_ranker_home_v1.meta.json",
        "policy_ranker_auto_v1.meta.json",
        "policy_ranker_life_v1.meta.json",
        "policy_ranker_pet_v1.meta.json",
    ):
        src = os.path.join(artifacts_dir, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(BASELINE_DIR, name))


def write_model_comparison(reports_dir: str) -> None:
    models = {
        "claim_risk": "claim_risk_metrics.json",
        "fraud": "fraud_metrics.json",
        "policy_ranker_home": "policy_ranker_home_metrics.json",
        "policy_ranker_auto": "policy_ranker_auto_metrics.json",
        "policy_ranker_life": "policy_ranker_life_metrics.json",
        "policy_ranker_pet": "policy_ranker_pet_metrics.json",
    }
    comparison: dict[str, dict] = {}
    for model_name, filename in models.items():
        baseline_path = os.path.join(BASELINE_DIR, filename)
        new_path = os.path.join(reports_dir, filename)
        entry: dict[str, dict] = {}
        if os.path.isfile(baseline_path):
            with open(baseline_path, encoding="utf-8") as fh:
                entry["baseline"] = json.load(fh)
        if os.path.isfile(new_path):
            with open(new_path, encoding="utf-8") as fh:
                entry["retrained"] = json.load(fh)
        if "baseline" in entry and "retrained" in entry:
            entry["delta"] = {
                key: round(entry["retrained"].get(key, 0) - entry["baseline"].get(key, 0), 4)
                for key in METRIC_KEYS
                if key in entry["retrained"] and key in entry["baseline"]
            }
        if entry:
            comparison[model_name] = entry
    out_path = os.path.join(reports_dir, "model_comparison.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(comparison, fh, indent=2)
    print(f"Wrote model comparison → {out_path}")


def encode_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    order = feature_order()
    frame = df[CLAIM_RISK_NUMERIC].copy()
    for field, values in CLAIM_RISK_CATEGORICAL.items():
        for value in values:
            col = f"{field}__{value}"
            frame[col] = (df[field] == value).astype(float)
    return frame[order], order


def blend_hybrid_csv(
    synthetic_path: str,
    production_path: str,
    real_ratio: float = 0.3,
    min_real_rows: int = 200,
) -> tuple[str, dict]:
    synthetic = pd.read_csv(synthetic_path)
    if not os.path.isfile(production_path):
        return synthetic_path, {
            "mode": "synthetic_only",
            "synthetic_rows": len(synthetic),
            "production_rows": 0,
            "real_row_pct": 0.0,
        }

    production = pd.read_csv(production_path)
    if production.empty:
        return synthetic_path, {
            "mode": "synthetic_only",
            "synthetic_rows": len(synthetic),
            "production_rows": 0,
            "real_row_pct": 0.0,
        }

    ratio = real_ratio if len(production) >= min_real_rows else min(0.15, real_ratio)
    if ratio <= 0:
        return synthetic_path, {
            "mode": "synthetic_only",
            "synthetic_rows": len(synthetic),
            "production_rows": len(production),
            "real_row_pct": 0.0,
        }

    prod_target = max(1, int(len(synthetic) * ratio / max(1 - ratio, 0.05)))
    prod_sample = production.sample(n=min(prod_target, len(production)), random_state=42)
    synth_target = max(len(synthetic), int(len(prod_sample) * (1 - ratio) / ratio))
    synth_sample = synthetic.sample(n=min(synth_target, len(synthetic)), random_state=42)
    blended = pd.concat([synth_sample, prod_sample], ignore_index=True).sample(
        frac=1, random_state=42
    )

    os.makedirs(os.path.join(ML_ROOT, "data", "hybrid"), exist_ok=True)
    out_name = os.path.basename(synthetic_path).replace(".csv", "_hybrid.csv")
    out_path = os.path.join(ML_ROOT, "data", "hybrid", out_name)
    blended.to_csv(out_path, index=False)

    real_pct = round((len(prod_sample) / len(blended)) * 100, 2)
    return out_path, {
        "mode": "hybrid",
        "synthetic_rows": len(synth_sample),
        "production_rows": len(prod_sample),
        "total_rows": len(blended),
        "real_row_pct": real_pct,
        "synthetic_row_pct": round(100 - real_pct, 2),
        "path": out_path,
    }


def resolve_training_csv(
    data_source: str,
    synthetic_path: str,
    production_name: str,
    blend_ratio: float,
) -> tuple[str, dict]:
    production_path = os.path.join(PRODUCTION_DIR, production_name)
    if data_source == "synthetic":
        return synthetic_path, {"mode": "synthetic", "path": synthetic_path}
    if data_source == "production":
        if not os.path.isfile(production_path):
            raise SystemExit(f"Missing production CSV: {production_path}")
        return production_path, {"mode": "production", "path": production_path}
    csv_path, blend_meta = blend_hybrid_csv(synthetic_path, production_path, blend_ratio)
    return csv_path, blend_meta


def train_claim_risk(
    csv_path: str,
    reports_dir: str,
    models_dir: str,
    artifact_version: str = "claim_risk_v1",
) -> dict:
    df = pd.read_csv(csv_path)
    x_raw, order = encode_dataframe(df)
    y = df["high_risk"].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    x_test_s = scaler.transform(x_test)

    model = LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)
    model.fit(x_train_s, y_train)

    probs = model.predict_proba(x_test_s)[:, 1]
    preds = (probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, preds)
    metrics = build_metrics(y_test, preds, probs, cm, len(x_train), len(x_test))

    os.makedirs(reports_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(4, 3))
    ax.imshow(cm, cmap="Blues")
    ax.set_title("Claim risk confusion matrix")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for (i, j), val in np.ndenumerate(cm):
        ax.text(j, i, str(val), ha="center", va="center")
    cm_path = os.path.join(reports_dir, "claim_risk_confusion_matrix.png")
    fig.tight_layout()
    fig.savefig(cm_path, dpi=120)
    plt.close(fig)

    metrics_path = os.path.join(reports_dir, "claim_risk_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    joblib.dump(model, os.path.join(models_dir, f"{artifact_version}.joblib"))
    joblib.dump(scaler, os.path.join(models_dir, "claim_risk_scaler.joblib"))

    trained_at = datetime.now(timezone.utc).isoformat()
    artifact = {
        "version": artifact_version,
        "modelType": "logistic_regression",
        "trainedAt": trained_at,
        "featureOrder": order,
        "numericFeatures": CLAIM_RISK_NUMERIC,
        "categoricalFeatures": CLAIM_RISK_CATEGORICAL,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
        },
        "coefficients": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "threshold": 0.5,
    }
    meta = {
        "version": artifact_version,
        "trainedAt": trained_at,
        "metrics": metrics,
        "sourceCsv": os.path.relpath(csv_path, ML_ROOT),
        "reports": {
            "metricsJson": os.path.relpath(metrics_path, ML_ROOT),
            "confusionMatrixPng": os.path.relpath(cm_path, ML_ROOT),
        },
    }
    return {"artifact": artifact, "meta": meta}


def encode_fraud_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    order = fraud_feature_order()
    frame = df[FRAUD_NUMERIC].copy()
    for field, values in FRAUD_CATEGORICAL.items():
        for value in values:
            col = f"{field}__{value}"
            frame[col] = (df[field] == value).astype(float)
    return frame[order], order


def train_fraud(
    csv_path: str,
    reports_dir: str,
    models_dir: str,
    artifact_version: str = "fraud_v1",
) -> dict:
    df = pd.read_csv(csv_path)
    x_raw, order = encode_fraud_dataframe(df)
    y = df["fraudulent"].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    x_test_s = scaler.transform(x_test)

    model = LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)
    model.fit(x_train_s, y_train)

    probs = model.predict_proba(x_test_s)[:, 1]
    preds = (probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, preds)
    metrics = build_metrics(y_test, preds, probs, cm, len(x_train), len(x_test))

    os.makedirs(reports_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(4, 3))
    ax.imshow(cm, cmap="Blues")
    ax.set_title("Fraud ML confusion matrix")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for (i, j), val in np.ndenumerate(cm):
        ax.text(j, i, str(val), ha="center", va="center")
    cm_path = os.path.join(reports_dir, "fraud_confusion_matrix.png")
    fig.tight_layout()
    fig.savefig(cm_path, dpi=120)
    plt.close(fig)

    metrics_path = os.path.join(reports_dir, "fraud_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    joblib.dump(model, os.path.join(models_dir, f"{artifact_version}.joblib"))
    joblib.dump(scaler, os.path.join(models_dir, "fraud_scaler.joblib"))

    trained_at = datetime.now(timezone.utc).isoformat()
    artifact = {
        "version": artifact_version,
        "modelType": "logistic_regression",
        "trainedAt": trained_at,
        "featureOrder": order,
        "numericFeatures": FRAUD_NUMERIC,
        "categoricalFeatures": FRAUD_CATEGORICAL,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
        },
        "coefficients": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "threshold": 0.5,
    }
    meta = {
        "version": artifact_version,
        "trainedAt": trained_at,
        "metrics": metrics,
        "sourceCsv": os.path.relpath(csv_path, ML_ROOT),
        "reports": {
            "metricsJson": os.path.relpath(metrics_path, ML_ROOT),
            "confusionMatrixPng": os.path.relpath(cm_path, ML_ROOT),
        },
    }
    return {"artifact": artifact, "meta": meta}


def encode_ranker_dataframe(df: pd.DataFrame, category: str) -> tuple[pd.DataFrame, list[str]]:
    order = ranker_feature_order(category)
    frame = df[RANKER_NUMERIC].copy()
    categorical = RANKER_CATEGORICAL_BY_CATEGORY[category]
    for field, values in categorical.items():
        for value in values:
            col = f"{field}__{value}"
            frame[col] = (df[field] == value).astype(float)
    return frame[order], order


def train_policy_ranker(
    csv_path: str,
    category: str,
    reports_dir: str,
    models_dir: str,
    artifact_version: str | None = None,
) -> dict:
    df = pd.read_csv(csv_path)
    subset = df[df["category"] == category].copy()
    if subset.empty:
        raise SystemExit(f"No training rows for category={category} in {csv_path}")

    x_raw, order = encode_ranker_dataframe(subset, category)
    y = subset["label"].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    x_test_s = scaler.transform(x_test)

    model = LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)
    model.fit(x_train_s, y_train)

    probs = model.predict_proba(x_test_s)[:, 1]
    preds = (probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, preds)
    metrics = build_metrics(y_test, preds, probs, cm, len(x_train), len(x_test))

    os.makedirs(reports_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(4, 3))
    ax.imshow(cm, cmap="Blues")
    ax.set_title(f"Policy ranker ({category}) confusion matrix")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for (i, j), val in np.ndenumerate(cm):
        ax.text(j, i, str(val), ha="center", va="center")
    cm_path = os.path.join(reports_dir, f"policy_ranker_{category}_confusion_matrix.png")
    fig.tight_layout()
    fig.savefig(cm_path, dpi=120)
    plt.close(fig)

    metrics_path = os.path.join(reports_dir, f"policy_ranker_{category}_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    version = artifact_version or f"policy_ranker_{category}_v1"
    joblib.dump(model, os.path.join(models_dir, f"{version}.joblib"))
    joblib.dump(scaler, os.path.join(models_dir, f"{version}_scaler.joblib"))

    trained_at = datetime.now(timezone.utc).isoformat()
    artifact = {
        "version": version,
        "category": category,
        "modelType": "logistic_regression",
        "trainedAt": trained_at,
        "featureOrder": order,
        "numericFeatures": RANKER_NUMERIC,
        "categoricalFeatures": RANKER_CATEGORICAL_BY_CATEGORY[category],
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
        },
        "coefficients": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "threshold": 0.5,
    }
    meta = {
        "version": version,
        "category": category,
        "trainedAt": trained_at,
        "metrics": metrics,
        "sourceCsv": os.path.relpath(csv_path, ML_ROOT),
        "reports": {
            "metricsJson": os.path.relpath(metrics_path, ML_ROOT),
            "confusionMatrixPng": os.path.relpath(cm_path, ML_ROOT),
        },
    }
    return {"artifact": artifact, "meta": meta}


def write_artifacts(payload: dict, prefix: str, candidate: bool = False) -> None:
    target_dir = os.path.join(BACKEND_ARTIFACTS, "candidates") if candidate else BACKEND_ARTIFACTS
    os.makedirs(target_dir, exist_ok=True)
    artifact_path = os.path.join(target_dir, f"{prefix}.json")
    meta_path = os.path.join(target_dir, f"{prefix}.meta.json")
    with open(artifact_path, "w", encoding="utf-8") as fh:
        json.dump(payload["artifact"], fh, indent=2)
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(payload["meta"], fh, indent=2)
    print(f"Exported → {artifact_path}")
    print(f"Exported → {meta_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        choices=["claim_risk", "fraud", "policy_ranker", "all"],
        default="claim_risk",
    )
    parser.add_argument(
        "--csv",
        default=os.path.join(ML_ROOT, "data", "synthetic", "claims_train.csv"),
    )
    parser.add_argument(
        "--fraud-csv",
        default=os.path.join(ML_ROOT, "data", "synthetic", "fraud_train.csv"),
    )
    parser.add_argument(
        "--recommend-csv",
        default=os.path.join(ML_ROOT, "data", "synthetic", "recommendations_train.csv"),
    )
    parser.add_argument(
        "--data-source",
        choices=["synthetic", "production", "hybrid"],
        default="synthetic",
    )
    parser.add_argument("--version-suffix", default="v1")
    parser.add_argument("--blend-ratio", type=float, default=0.3)
    parser.add_argument(
        "--candidate",
        action="store_true",
        help="Write artifacts under backend artifacts/candidates instead of active folder",
    )
    args = parser.parse_args()

    reports_dir = os.path.join(ML_ROOT, "reports")
    models_dir = os.path.join(ML_ROOT, "models")
    candidate_mode = args.candidate or args.version_suffix != "v1"

    snapshot_baseline(reports_dir)

    claim_csv, _claim_blend = resolve_training_csv(
        args.data_source,
        args.csv,
        "claims_train.csv",
        args.blend_ratio,
    )
    fraud_csv, _fraud_blend = resolve_training_csv(
        args.data_source,
        args.fraud_csv,
        "fraud_train.csv",
        args.blend_ratio,
    )
    recommend_csv, _rank_blend = resolve_training_csv(
        args.data_source,
        args.recommend_csv,
        "recommendations_train.csv",
        args.blend_ratio,
    )

    if args.model in ("claim_risk", "all"):
        if not os.path.isfile(claim_csv):
            raise SystemExit(f"Missing training CSV: {claim_csv}. Run generate_synthetic_claims.py first.")
        claim_version = f"claim_risk_{args.version_suffix}"
        payload = train_claim_risk(claim_csv, reports_dir, models_dir, claim_version)
        write_artifacts(payload, claim_version, candidate=candidate_mode)

    if args.model in ("fraud", "all"):
        if not os.path.isfile(fraud_csv):
            raise SystemExit(f"Missing fraud CSV: {fraud_csv}. Run generate_synthetic_fraud.py first.")
        fraud_version = f"fraud_{args.version_suffix}"
        payload = train_fraud(fraud_csv, reports_dir, models_dir, fraud_version)
        write_artifacts(payload, fraud_version, candidate=candidate_mode)

    if args.model in ("policy_ranker", "all"):
        if not os.path.isfile(recommend_csv):
            raise SystemExit(
                f"Missing recommendations CSV: {recommend_csv}. "
                "Run generate_synthetic_recommendations.py first."
            )
        for category in ("home", "auto", "life", "pet"):
            ranker_version = f"policy_ranker_{category}_{args.version_suffix}"
            payload = train_policy_ranker(
                recommend_csv,
                category,
                reports_dir,
                models_dir,
                ranker_version,
            )
            write_artifacts(payload, ranker_version, candidate=candidate_mode)

    write_model_comparison(reports_dir)


if __name__ == "__main__":
    main()
