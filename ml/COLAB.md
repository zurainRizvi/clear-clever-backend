# Google Colab workflow

## Prerequisites

- Push the monorepo to GitHub, or upload the `ml/` folder to Google Drive.
- No GPU required (tabular models only).

## Notebook 01 — Synthetic data

1. Open `notebooks/01_generate_synthetic_data.ipynb` in Colab.
2. First cell:

```python
!pip install -q -r requirements.txt
```

3. If cloned from GitHub, `cd` into `ml/`. If uploaded, mount Drive and `cd` to your `ml` path.
4. Run all cells — writes CSVs under `data/synthetic/`.

## Notebook 02 — Claim risk

1. Open `notebooks/02_train_claim_risk.ipynb`.
2. Install requirements (same as above).
3. Ensure `data/synthetic/claims_train.csv` exists (run notebook 01 or `generate_synthetic_claims.py`).
4. Run training cells → metrics inline + `reports/claim_risk_metrics.json`.
5. Export:

```bash
!python scripts/export_for_node.py --model claim_risk
```

6. Download or commit `clear-clever-backend/src/ml/artifacts/claim_risk_v1.json`.

## Notebook 03 — Fraud ML

1. Open `notebooks/03_train_fraud_detection.ipynb`.
2. Run all cells → exports `fraud_v1.json` to backend artifacts.

## Notebook 04 — Policy recommender

1. Open `notebooks/04_train_policy_recommender.ipynb` in Colab.
2. Run generator + export:

```bash
!python scripts/generate_synthetic_recommendations.py
!python scripts/export_for_node.py --model policy_ranker
```

3. Commit `clear-clever-backend/src/ml/artifacts/policy_ranker_*_v1.json`.

## Verify in Node

```bash
cd clear-clever-backend
npm run test:ci
```

Tests in `claimRisk.test.ts` spot-check Python vs TypeScript inference on fixed vectors.
