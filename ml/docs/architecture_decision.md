# Architecture Decision — Logistic Regression vs XGBoost

Date: 2026-06-11  
Decision: **Remain on Logistic Regression for production**

## Context

ClearClever deploys tabular ML as lightweight JSON artifacts consumed by Node.js on Render. No Python inference service. After dataset expansion (10k rows), label leakage fixes, and LR retraining, we benchmarked gradient-boosted trees against LR on identical stratified splits (`random_state=42`, 80/20).

Benchmark source: `ml/reports/benchmark/lr_vs_xgboost_comparison.json`

> **Note:** Local macOS lacked `libomp` for native XGBoost; benchmark used `sklearn.ensemble.GradientBoostingClassifier` with equivalent hyperparameters (`max_depth=4`, `n_estimators=200`, `learning_rate=0.1`). Re-run `python scripts/benchmark_xgboost.py` in Colab for native XGBoost confirmation.

## Results (retrained 10k datasets)

### Claim risk

| Metric | Logistic Regression | Tree ensemble | Delta |
|--------|--------------------:|--------------:|------:|
| Accuracy | 0.8245 | 0.9115 | +8.7pp |
| **ROC-AUC** | **0.8459** | **0.8538** | **+0.79pp** |
| Precision | 0.6433 | 0.9100 | +26.7pp |
| Recall | 0.7380 | 0.7342 | −0.4pp |
| F1 | 0.6874 | 0.8127 | +12.5pp |

### Fraud detection

| Metric | Logistic Regression | Tree ensemble | Delta |
|--------|--------------------:|--------------:|------:|
| Accuracy | 0.7945 | 0.9155 | +12.1pp |
| **ROC-AUC** | **0.8369** | **0.8457** | **+0.87pp** |
| Precision | 0.9168 | 0.9174 | +0.06pp |
| Recall | 0.8069 | 0.9786 | +17.2pp |
| F1 | 0.8583 | 0.9470 | +8.9pp |

## Decision criteria evaluation

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| ROC-AUC improvement ≥ 5pp | Required for adoption | **Not met** (≈0.8–0.9pp) |
| F1 improvement ≥ 5pp | Secondary | Met for fraud (+8.9pp), marginal for claim risk |
| Python-server-free deployment | Required | LR satisfies; trees need new JSON parser |
| JSON artifact size | Target <50KB | LR ≈21KB total; 200-tree XGBoost dump estimated 200–500KB |
| Explainability | `topFactors` from coefficients | LR wins; tree gain importances less per-prediction |

## JSON tree export feasibility

- XGBoost `booster.dump_model()` produces nested tree JSON unsuitable for current `featureEncoding.ts` sigmoid path.
- Node would need a new inference module (tree traversal), increasing bundle size and test surface.
- ONNX migration explicitly deferred unless benchmark proves necessity — it does not.

## Verdict

**Keep Logistic Regression in production** for claim risk and fraud detection.

Rationale:

1. Primary metric (ROC-AUC) improvement is **under 1 percentage point** on identical splits — far below the 5pp adoption bar.
2. LR artifacts are **~21 KB**, load once, and integrate with existing `topFactors` explainability.
3. Tree models show higher accuracy/F1 partly from threshold tuning effects; ranking quality (ROC-AUC) is comparable.
4. Retrained LR already improved substantially vs baseline (+5.9pp ROC-AUC claim risk, +6.6pp fraud).

## Future triggers for re-evaluation

- Real Atlas production data shows LR ROC-AUC < 0.75 on holdout.
- Native XGBoost Colab benchmark exceeds +5pp ROC-AUC on same splits.
- Shallow tree export (<50 trees, <50KB) with TS inference prototype passes Jest.

## Policy ranker

Out of scope for tree benchmark. Per-category LR rankers already achieve ROC-AUC 0.99+ on rule-distilled labels; hybrid 30/70 blend with rules remains appropriate.
