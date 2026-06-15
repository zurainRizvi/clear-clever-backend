# Training Pipeline

## Sequence

```mermaid
sequenceDiagram
  participant Dev as Developer/Colab
  participant Gen as generate_synthetic_*.py
  participant CSV as data/synthetic/*.csv
  participant Exp as export_for_node.py
  participant Art as backend/src/ml/artifacts/
  participant CI as npm run test:ci

  Dev->>Gen: python scripts/generate_synthetic_*.py
  Gen->>CSV: Write 10k training CSVs
  Dev->>Exp: python scripts/export_for_node.py --model all
  Exp->>Art: claim_risk_v1.json, fraud_v1.json, policy_ranker_*_v1.json
  Exp->>Exp: ml/reports/*_metrics.json + confusion matrices
  Dev->>CI: Verify Jest ML tests
```

## Commands

```bash
cd ml && source .venv/bin/activate
pip install -r requirements.txt

python scripts/build_policy_manifest.py
python scripts/generate_synthetic_claims.py
python scripts/generate_synthetic_fraud.py
python scripts/generate_synthetic_recommendations.py
python scripts/analyze_datasets.py

python scripts/export_for_node.py --model all
python scripts/benchmark_xgboost.py   # offline only

cd ../clear-clever-backend
npx jest src/claimRisk.test.ts src/fraudMl.test.ts src/hybridRecommendation.test.ts
```

## Algorithm

- **Model:** `LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)`
- **Preprocessing:** `StandardScaler` on one-hot encoded features
- **Split:** 80/20 stratified, `random_state=42`
- **Threshold:** 0.5 (evaluation); Node uses raw sigmoid probability

## Artifact schema

```json
{
  "version": "claim_risk_v1",
  "modelType": "logistic_regression",
  "featureOrder": ["estimated_amount_pkr", "...", "claim_type__accident"],
  "scaler": { "mean": [], "scale": [] },
  "coefficients": [],
  "intercept": 0.0,
  "threshold": 0.5
}
```

Metadata in paired `*.meta.json` includes metrics and source CSV path.
