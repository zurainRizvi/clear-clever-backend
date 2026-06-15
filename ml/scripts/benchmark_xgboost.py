#!/usr/bin/env python3
"""Benchmark XGBoost vs Logistic Regression (offline — no production export)."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

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
from sklearn.ensemble import GradientBoostingClassifier

from _shared import ML_ROOT

try:
    from xgboost import XGBClassifier

    XGBOOST_AVAILABLE = True
except Exception:
    XGBOOST_AVAILABLE = False
from export_for_node import build_metrics, encode_dataframe, encode_fraud_dataframe

BENCHMARK_DIR = os.path.join(ML_ROOT, "reports", "benchmark")
SPLIT_RANDOM_STATE = 42
TEST_SIZE = 0.2


def train_lr(x_train: np.ndarray, x_test: np.ndarray, y_train: pd.Series, y_test: pd.Series) -> dict:
    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    x_test_s = scaler.transform(x_test)
    model = LogisticRegression(max_iter=500, class_weight="balanced", random_state=SPLIT_RANDOM_STATE)
    model.fit(x_train_s, y_train)
    probs = model.predict_proba(x_test_s)[:, 1]
    preds = (probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, preds)
    return build_metrics(y_test, preds, probs, cm, len(x_train), len(x_test))


def _tree_feature_importance(model, feature_names: list[str]) -> dict[str, float]:
    if hasattr(model, "feature_importances_"):
        raw = model.feature_importances_
        total = float(raw.sum()) or 1.0
        pairs = sorted(zip(feature_names, raw), key=lambda x: -x[1])
        return {name: round(float(score) / total, 6) for name, score in pairs if score > 0}
    return {}


def train_xgb(
    x_train: np.ndarray,
    x_test: np.ndarray,
    y_train: pd.Series,
    y_test: pd.Series,
    feature_names: list[str],
) -> tuple[dict, dict[str, float], str]:
    neg = int((y_train == 0).sum())
    pos = int((y_train == 1).sum())
    scale_pos_weight = neg / max(pos, 1)

    backend = "xgboost"
    if XGBOOST_AVAILABLE:
        model = XGBClassifier(
            max_depth=4,
            n_estimators=200,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight,
            random_state=SPLIT_RANDOM_STATE,
            eval_metric="logloss",
            verbosity=0,
        )
    else:
        backend = "sklearn_gradient_boosting_fallback"
        model = GradientBoostingClassifier(
            max_depth=4,
            n_estimators=200,
            learning_rate=0.1,
            random_state=SPLIT_RANDOM_STATE,
        )

    model.fit(x_train, y_train)
    probs = model.predict_proba(x_test)[:, 1]
    preds = (probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, preds)
    metrics = build_metrics(y_test, preds, probs, cm, len(x_train), len(x_test))
    metrics["backend"] = backend

    if XGBOOST_AVAILABLE and hasattr(model, "get_booster"):
        raw_importance = model.get_booster().get_score(importance_type="gain")
        mapped: dict[str, float] = {name: 0.0 for name in feature_names}
        for key, value in raw_importance.items():
            if key.startswith("f"):
                idx = int(key[1:])
                if idx < len(feature_names):
                    mapped[feature_names[idx]] = float(value)
        total = sum(mapped.values()) or 1.0
        normalized = {k: round(v / total, 6) for k, v in sorted(mapped.items(), key=lambda x: -x[1]) if v > 0}
    else:
        normalized = _tree_feature_importance(model, feature_names)

    return metrics, normalized, backend


def benchmark_task(
    name: str,
    csv_path: str,
    label_col: str,
    encode_fn,
) -> dict:
    df = pd.read_csv(csv_path)
    x_raw, feature_order = encode_fn(df)
    y = df[label_col].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x_raw, y, test_size=TEST_SIZE, random_state=SPLIT_RANDOM_STATE, stratify=y
    )

    lr_metrics = train_lr(x_train.values, x_test.values, y_train, y_test)
    xgb_metrics, importance, backend = train_xgb(
        x_train.values, x_test.values, y_train, y_test, feature_order
    )

    return {
        "task": name,
        "csv": os.path.relpath(csv_path, ML_ROOT),
        "split": {"test_size": TEST_SIZE, "random_state": SPLIT_RANDOM_STATE},
        "tree_backend": backend,
        "logistic_regression": lr_metrics,
        "xgboost": xgb_metrics,
        "feature_importance": importance,
        "delta": {
            key: round(xgb_metrics[key] - lr_metrics[key], 4)
            for key in ("accuracy", "roc_auc", "precision", "recall", "f1")
        },
    }


def write_benchmark_report(comparison: dict, path: str) -> None:
    lines = [
        "# XGBoost Benchmark Report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Offline benchmark only — production remains Logistic Regression JSON artifacts.",
        "",
    ]
    for task, data in comparison.get("tasks", {}).items():
        lr = data["logistic_regression"]
        xgb = data["xgboost"]
        delta = data["delta"]
        lines.extend(
            [
                f"## {task}",
                "",
                "| Metric | Logistic Regression | XGBoost | Delta |",
                "|--------|--------------------:|--------:|------:|",
            ]
        )
        for metric in ("accuracy", "roc_auc", "precision", "recall", "f1"):
            lines.append(
                f"| {metric} | {lr[metric]:.4f} | {xgb[metric]:.4f} | {delta[metric]:+.4f} |"
            )
        lines.append("")
        lines.append("**Top XGBoost features (gain, normalized):**")
        for feat, score in list(data["feature_importance"].items())[:8]:
            lines.append(f"- {feat}: {score:.4f}")
        lines.append("")

    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--claims-csv",
        default=os.path.join(ML_ROOT, "data", "synthetic", "claims_train.csv"),
    )
    parser.add_argument(
        "--fraud-csv",
        default=os.path.join(ML_ROOT, "data", "synthetic", "fraud_train.csv"),
    )
    args = parser.parse_args()

    os.makedirs(BENCHMARK_DIR, exist_ok=True)

    claim_result = benchmark_task("claim_risk", args.claims_csv, "high_risk", encode_dataframe)
    fraud_result = benchmark_task("fraud", args.fraud_csv, "fraudulent", encode_fraud_dataframe)

    with open(os.path.join(BENCHMARK_DIR, "xgboost_claim_risk_metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(claim_result["xgboost"], fh, indent=2)
    with open(os.path.join(BENCHMARK_DIR, "xgboost_fraud_metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(fraud_result["xgboost"], fh, indent=2)

    with open(os.path.join(BENCHMARK_DIR, "xgboost_feature_importance_claim_risk.json"), "w", encoding="utf-8") as fh:
        json.dump(claim_result["feature_importance"], fh, indent=2)
    with open(os.path.join(BENCHMARK_DIR, "xgboost_feature_importance_fraud.json"), "w", encoding="utf-8") as fh:
        json.dump(fraud_result["feature_importance"], fh, indent=2)

    comparison = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "xgboost_native": XGBOOST_AVAILABLE,
        "tasks": {
            "claim_risk": claim_result,
            "fraud": fraud_result,
        },
        "summary_table": {
            task: {
                "lr": result["logistic_regression"],
                "xgboost": result["xgboost"],
                "delta": result["delta"],
            }
            for task, result in (("claim_risk", claim_result), ("fraud", fraud_result))
        },
    }
    with open(os.path.join(BENCHMARK_DIR, "lr_vs_xgboost_comparison.json"), "w", encoding="utf-8") as fh:
        json.dump(comparison, fh, indent=2)

    write_benchmark_report(comparison, os.path.join(BENCHMARK_DIR, "benchmark_report.md"))
    print(f"Benchmark reports written to {BENCHMARK_DIR}")


if __name__ == "__main__":
    main()
