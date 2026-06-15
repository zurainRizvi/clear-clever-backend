#!/usr/bin/env python3
"""Upload candidate ML artifacts to the ClearClever backend registry."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request

from _shared import BACKEND_ARTIFACTS, ML_ROOT

MODEL_MAP = {
    "claim_risk": "claim_risk",
    "fraud": "fraud",
    "policy_ranker_home": "policy_ranker_home",
    "policy_ranker_auto": "policy_ranker_auto",
    "policy_ranker_life": "policy_ranker_life",
    "policy_ranker_pet": "policy_ranker_pet",
}


def upload_candidate(
    api_url: str,
    api_key: str,
    model_key: str,
    version_suffix: str,
) -> None:
    prefix = MODEL_MAP[model_key]
    version = f"{prefix}_{version_suffix}"
    artifact_path = os.path.join(BACKEND_ARTIFACTS, "candidates", f"{version}.json")
    meta_path = os.path.join(BACKEND_ARTIFACTS, "candidates", f"{version}.meta.json")

    if not os.path.isfile(artifact_path):
        artifact_path = os.path.join(BACKEND_ARTIFACTS, f"{version}.json")
        meta_path = os.path.join(BACKEND_ARTIFACTS, f"{version}.meta.json")

    if not os.path.isfile(artifact_path):
        print(f"Skipping {model_key}: missing artifact at {artifact_path}")
        return

    with open(artifact_path, encoding="utf-8") as fh:
        artifact = json.load(fh)
    meta = {}
    if os.path.isfile(meta_path):
        with open(meta_path, encoding="utf-8") as fh:
            meta = json.load(fh)

    comparison_path = os.path.join(ML_ROOT, "reports", "model_comparison.json")
    comparison = {}
    if os.path.isfile(comparison_path):
        with open(comparison_path, encoding="utf-8") as fh:
            comparison = json.load(fh)

    model_comparison = comparison.get(model_key.replace("policy_ranker_", "policy_ranker_"), {})
    if model_key.startswith("policy_ranker_"):
        model_comparison = comparison.get(model_key, {})

    retrained = model_comparison.get("retrained", meta.get("metrics", {}))
    delta = model_comparison.get("delta", {})
    export_summary_path = os.path.join(ML_ROOT, "reports", "production", "export_summary.json")
    real_row_pct = None
    synthetic_row_pct = None
    if os.path.isfile(export_summary_path):
        with open(export_summary_path, encoding="utf-8") as fh:
            export_summary = json.load(fh)
        total = max(export_summary.get("counts", {}).get("total", 0), 1)
        real_row_pct = round((total / max(total + 8000, 1)) * 100, 2)
        synthetic_row_pct = round(100 - real_row_pct, 2)

    payload = {
        "modelId": model_key,
        "candidateVersion": version,
        "artifact": artifact,
        "meta": meta,
        "report": {
            "trainedAt": meta.get("trainedAt", artifact.get("trainedAt")),
            "metrics": retrained,
            "delta": delta,
            "realRowPct": real_row_pct,
            "syntheticRowPct": synthetic_row_pct,
            "totalRows": retrained.get("train_rows", 0) + retrained.get("test_rows", 0),
            "driftNotes": [],
            "comparisonSource": "model_comparison.json",
        },
    }

    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/api/internal/ml-retrain/candidate",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-ml-retrain-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
            print(f"Uploaded {model_key}: {body}")
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8")
        raise SystemExit(f"Upload failed for {model_key}: {err.code} {detail}") from err


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default=os.environ.get("API_PUBLIC_URL", "http://localhost:5000"))
    parser.add_argument("--api-key", default=os.environ.get("ML_RETRAIN_API_KEY"))
    parser.add_argument("--version-suffix", default="v2")
    parser.add_argument(
        "--model",
        choices=list(MODEL_MAP.keys()) + ["all"],
        default="all",
    )
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit("ML_RETRAIN_API_KEY is required")

    targets = list(MODEL_MAP.keys()) if args.model == "all" else [args.model]
    for model_key in targets:
        upload_candidate(args.api_url, args.api_key, model_key, args.version_suffix)


if __name__ == "__main__":
    main()
