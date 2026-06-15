#!/usr/bin/env python3
"""Compare old vs new synthetic datasets — distributions, class balance, correlations."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency

from _shared import ML_ROOT

ARCHIVE_DIR = os.path.join(ML_ROOT, "data", "synthetic", "archive", "pre_10k")
REPORTS_DIR = os.path.join(ML_ROOT, "reports", "dataset_analysis")

OLD_SIZES = {
    "claims": {"rows": 4000, "seed": 42},
    "fraud": {"rows": 3000, "seed": 7},
    "recommendations": {"journeys": 2500, "seed": 99},
}

LABEL_COLUMNS = {
    "claims_train.csv": "high_risk",
    "fraud_train.csv": "fraudulent",
    "recommendations_train.csv": "label",
}


def _numeric_summary(series: pd.Series) -> dict[str, float]:
    return {
        "mean": float(series.mean()),
        "std": float(series.std()),
        "min": float(series.min()),
        "max": float(series.max()),
        "median": float(series.median()),
    }


def _categorical_counts(series: pd.Series) -> dict[str, int]:
    return {str(k): int(v) for k, v in series.value_counts().to_dict().items()}


def _cramers_v(df: pd.DataFrame, col_a: str, col_b: str) -> float:
    contingency = pd.crosstab(df[col_a], df[col_b])
    if contingency.size == 0:
        return 0.0
    chi2, _, _, _ = chi2_contingency(contingency)
    n = contingency.sum().sum()
    r, k = contingency.shape
    if n == 0 or min(r - 1, k - 1) == 0:
        return 0.0
    return float(np.sqrt(chi2 / (n * min(r - 1, k - 1))))


def dataset_profile(df: pd.DataFrame, name: str) -> dict[str, Any]:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    exclude = {"id", "high_risk", "fraudulent", "label"}
    numeric_cols = [c for c in numeric_cols if c not in exclude]

    profile: dict[str, Any] = {
        "name": name,
        "rows": int(len(df)),
        "numeric": {col: _numeric_summary(df[col]) for col in numeric_cols},
        "categorical": {},
    }
    for col in df.select_dtypes(include=["object", "string"]).columns:
        if col in ("id",):
            continue
        profile["categorical"][col] = _categorical_counts(df[col])
    return profile


def class_balance(df: pd.DataFrame, label_col: str, group_col: str | None = None) -> dict[str, Any]:
    total_pos = int(df[label_col].sum())
    result: dict[str, Any] = {
        "label": label_col,
        "total_rows": int(len(df)),
        "positives": total_pos,
        "positive_rate": round(total_pos / max(len(df), 1), 4),
    }
    if group_col and group_col in df.columns:
        by_group: dict[str, Any] = {}
        for group, subset in df.groupby(group_col):
            pos = int(subset[label_col].sum())
            by_group[str(group)] = {
                "rows": int(len(subset)),
                "positives": pos,
                "positive_rate": round(pos / max(len(subset), 1), 4),
            }
        result["by_group"] = by_group
    return result


def correlation_analysis(df: pd.DataFrame, name: str) -> dict[str, Any]:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    exclude = {"id"}
    numeric_cols = [c for c in numeric_cols if c not in exclude]
    pearson: dict[str, Any] = {}
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr(method="pearson")
        pearson = {
            f"{a}|{b}": round(float(corr.loc[a, b]), 4)
            for a in numeric_cols
            for b in numeric_cols
            if a < b and not np.isnan(corr.loc[a, b])
        }

    cat_cols = [c for c in df.select_dtypes(include=["object", "string"]).columns if c != "id"]
    cramers: dict[str, float] = {}
    for i, col_a in enumerate(cat_cols):
        for col_b in cat_cols[i + 1 :]:
            cramers[f"{col_a}|{col_b}"] = round(_cramers_v(df, col_a, col_b), 4)

    label_col = LABEL_COLUMNS.get(f"{name}.csv") or LABEL_COLUMNS.get(os.path.basename(name))
    label_associations: dict[str, float] = {}
    if label_col and label_col in df.columns:
        for col in numeric_cols:
            if col == label_col:
                continue
            label_associations[col] = round(float(df[col].corr(df[label_col])), 4)

    return {
        "dataset": name,
        "pearson_numeric": pearson,
        "cramers_v_categorical": cramers,
        "numeric_label_correlation": label_associations,
    }


def compare_profiles(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    return {
        "old_rows": old["rows"],
        "new_rows": new["rows"],
        "row_growth_pct": round((new["rows"] - old["rows"]) / max(old["rows"], 1) * 100, 1),
        "numeric_deltas": {
            col: {
                "mean_delta": round(
                    new["numeric"].get(col, {}).get("mean", 0)
                    - old["numeric"].get(col, {}).get("mean", 0),
                    4,
                ),
                "std_delta": round(
                    new["numeric"].get(col, {}).get("std", 0)
                    - old["numeric"].get(col, {}).get("std", 0),
                    4,
                ),
            }
            for col in set(old.get("numeric", {})) | set(new.get("numeric", {}))
        },
    }


def archive_current_csvs(synthetic_dir: str) -> None:
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    for filename in ("claims_train.csv", "fraud_train.csv", "recommendations_train.csv"):
        src = os.path.join(synthetic_dir, filename)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(ARCHIVE_DIR, filename))


def write_summary_md(
    comparisons: dict[str, Any],
    balances: dict[str, Any],
    path: str,
) -> None:
    lines = [
        "# Dataset Expansion Summary",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Row counts",
        "",
        "| Dataset | Old rows | New rows | Growth |",
        "|---------|----------|----------|--------|",
    ]
    for name, comp in comparisons.items():
        lines.append(
            f"| {name} | {comp['old_rows']} | {comp['new_rows']} | {comp['row_growth_pct']}% |"
        )
    lines.extend(["", "## Class balance (new datasets)", ""])
    for name, bal in balances.items():
        lines.append(f"### {name}")
        lines.append(f"- Positives: {bal['positives']} / {bal['total_rows']} ({bal['positive_rate']:.1%})")
        if "by_group" in bal:
            for group, stats in bal["by_group"].items():
                lines.append(
                    f"  - {group}: {stats['positives']}/{stats['rows']} ({stats['positive_rate']:.1%})"
                )
        lines.append("")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--synthetic-dir",
        default=os.path.join(ML_ROOT, "data", "synthetic"),
    )
    parser.add_argument("--archive", action="store_true", help="Copy current CSVs to archive before compare")
    args = parser.parse_args()

    os.makedirs(REPORTS_DIR, exist_ok=True)

    if args.archive:
        archive_current_csvs(args.synthetic_dir)

    datasets = {
        "claims": "claims_train.csv",
        "fraud": "fraud_train.csv",
        "recommendations": "recommendations_train.csv",
    }

    distribution_comparison: dict[str, Any] = {}
    class_balance_report: dict[str, Any] = {}
    correlation_report: dict[str, Any] = {}
    comparisons: dict[str, Any] = {}

    for key, filename in datasets.items():
        new_path = os.path.join(args.synthetic_dir, filename)
        old_path = os.path.join(ARCHIVE_DIR, filename)
        if not os.path.isfile(new_path):
            print(f"Skip {filename}: missing new file")
            continue

        new_df = pd.read_csv(new_path)
        new_profile = dataset_profile(new_df, key)
        correlation_report[key] = correlation_analysis(new_df, filename)

        label_col = LABEL_COLUMNS[filename]
        group_col = "category" if filename == "recommendations_train.csv" else None
        class_balance_report[key] = class_balance(new_df, label_col, group_col)

        if os.path.isfile(old_path):
            old_df = pd.read_csv(old_path)
            old_profile = dataset_profile(old_df, key)
            distribution_comparison[key] = {
                "old": old_profile,
                "new": new_profile,
                "comparison": compare_profiles(old_profile, new_profile),
            }
            comparisons[key] = distribution_comparison[key]["comparison"]
        else:
            distribution_comparison[key] = {"new": new_profile}

    with open(os.path.join(REPORTS_DIR, "distribution_comparison.json"), "w", encoding="utf-8") as fh:
        json.dump(distribution_comparison, fh, indent=2)

    with open(os.path.join(REPORTS_DIR, "class_balance_report.json"), "w", encoding="utf-8") as fh:
        json.dump(class_balance_report, fh, indent=2)

    with open(os.path.join(REPORTS_DIR, "correlation_analysis.json"), "w", encoding="utf-8") as fh:
        json.dump(correlation_report, fh, indent=2)

    write_summary_md(
        comparisons,
        class_balance_report,
        os.path.join(REPORTS_DIR, "dataset_expansion_summary.md"),
    )
    print(f"Reports written to {REPORTS_DIR}")


if __name__ == "__main__":
    main()
