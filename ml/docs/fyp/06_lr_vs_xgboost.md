# Logistic Regression vs Tree Ensemble Benchmark

Offline benchmark — **does not affect production artifacts**.

Source: `ml/reports/benchmark/lr_vs_xgboost_comparison.json`, `benchmark_report.md`

## Claim risk (identical split, random_state=42)

| Metric | LR | Tree ensemble | Delta |
|--------|-----|---------------|-------|
| Accuracy | 0.825 | 0.912 | +8.7pp |
| ROC-AUC | 0.846 | 0.854 | +0.8pp |
| Precision | 0.643 | 0.910 | +26.7pp |
| Recall | 0.738 | 0.734 | −0.4pp |
| F1 | 0.687 | 0.813 | +12.5pp |

Top tree features: `user_rejected_claims`, `user_claims_7d`, `amount_to_premium_ratio`

## Fraud detection

| Metric | LR | Tree ensemble | Delta |
|--------|-----|---------------|-------|
| Accuracy | 0.795 | 0.916 | +12.1pp |
| ROC-AUC | 0.837 | 0.846 | +0.9pp |
| Precision | 0.917 | 0.917 | +0.1pp |
| Recall | 0.807 | 0.979 | +17.2pp |
| F1 | 0.858 | 0.947 | +8.9pp |

Top tree features: `related_entity_count`, `severity_encoded`, `account_age_days`

## Decision

Per `ml/docs/architecture_decision.md`: **remain on Logistic Regression**.

ROC-AUC gains (~0.8–0.9pp) are below the 5pp adoption threshold. LR provides coefficient-based explainability and ~21 KB JSON artifacts compatible with existing Node inference.

Re-run native XGBoost in Colab (`pip install xgboost`) to confirm; local macOS may require `brew install libomp`.
