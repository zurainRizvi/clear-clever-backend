# ClearClever ML Layer

Jury-ready Python training workspace for ClearClever's hybrid AI features. Models train here (Google Colab or local venv) and deploy as **JSON artifacts** consumed by the Node backend — no Python on Render.

## Features

| # | Feature | Model | UI |
|---|---------|-------|-----|
| 1 | Claim risk scoring | Logistic regression (tabular) | Insurer claims portal |
| 2 | Admin fraud ML | LR + isolation forest (planned) | Admin fraud page |
| 3 | AI Claims Intelligence Engine | Gemini 2.5 structured JSON (API) | Seeker + insurer claims |
| 4 | Policy recommender | Hybrid rules + per-category ranker (live) | Compare policies |

## Quick start (local)

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Generate 10k datasets + analysis
python scripts/build_policy_manifest.py
python scripts/generate_synthetic_claims.py      # 10,000 rows
python scripts/generate_synthetic_fraud.py       # 10,000 rows
python scripts/generate_synthetic_recommendations.py  # 10,000 journeys
python scripts/analyze_datasets.py

# Train + export production LR artifacts
python scripts/export_for_node.py --model all

# Offline tree benchmark (does not replace production)
python scripts/benchmark_xgboost.py
```

Artifacts land in `../clear-clever-backend/src/ml/artifacts/`.

## Colab

See [COLAB.md](./COLAB.md) for notebook-by-notebook steps.

## Data honesty (FYP)

Training data is **semi-synthetic**: feature distributions and labels are calibrated to ClearClever's Pakistan insurance schema (`demoSeedData.ts`, `questionTemplates.ts`), augmented to reach usable sample sizes. Production inference uses the same feature contract documented in [`data/schema.md`](./data/schema.md).

## Folder map

```
ml/
  notebooks/     # 01–04 Colab notebooks
  scripts/       # generators, analyze_datasets, export_for_node, benchmark_xgboost
  data/          # schema + synthetic CSVs + archive/pre_10k
  docs/          # label_rules, leakage_analysis, architecture_decision, fyp/
  models/        # joblib (training only, gitignored)
  reports/       # metrics, baseline, dataset_analysis, benchmark
```

## FYP documentation

Jury-ready write-ups under [`docs/fyp/`](./docs/fyp/):

- [Dataset methodology](./docs/fyp/01_dataset_methodology.md)
- [ML architecture](./docs/fyp/02_ml_architecture.md)
- [Training pipeline](./docs/fyp/03_training_pipeline.md)
- [Node inference](./docs/fyp/04_node_inference.md)
- [Evaluation results](./docs/fyp/05_evaluation_results.md)
- [LR vs XGBoost](./docs/fyp/06_lr_vs_xgboost.md)
- [Scalability & future](./docs/fyp/07_scalability_and_future.md)

Label audit: [`docs/label_rules.md`](./docs/label_rules.md), [`docs/leakage_analysis.md`](./docs/leakage_analysis.md)  
Architecture decision: [`docs/architecture_decision.md`](./docs/architecture_decision.md) — **remain on Logistic Regression**

## Jury demo (5 min)

1. Seeker questionnaire → AI-ranked policies (hybrid)
2. Seeker uploads evidence → **AI Claims Intelligence Report** (damage, docs, consistency, readiness)
3. Insurer claims → unified intelligence card + ML risk score
4. Super admin fraud → heuristic + ML confidence
5. Show this folder + Colab notebook + `reports/claim_risk_confusion_matrix.png`

**One-liner:** *Traditional ML for risk and ranking; Gemini intelligence for evidence assessment — trained in Colab, deployed as JSON in Node.*
