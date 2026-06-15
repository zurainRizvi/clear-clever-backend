# Dataset Generation Methodology

## Overview

ClearClever trains on **semi-synthetic** tabular data calibrated to Pakistan insurance schema (claim types, policy categories, city regions, PKR amounts). Data is generated locally or in Colab, not exported from production Atlas with PII.

## Datasets

| Dataset | Rows | Seed | Generator |
|---------|------|------|-----------|
| Claims | 10,000 | 42 | `generate_synthetic_claims.py` |
| Fraud | 10,000 | 7 | `generate_synthetic_fraud.py` |
| Recommendations | 145,000 pair-rows (10k journeys) | 99 | `generate_synthetic_recommendations.py` |

Archived pre-expansion copies: `ml/data/synthetic/archive/pre_10k/`

## Design principles

1. **Realistic distributions** — claim-type-specific amount bands, category-signal bias for fraud, policy manifest from `policySeedData.ts`.
2. **Meaningful correlations** — e.g. high claim amounts → longer reporting delay; burst claims → elevated rejections.
3. **No pure random labels** — teachers use domain rules documented in `ml/docs/label_rules.md`.
4. **Reproducibility** — fixed `random.Random(seed)` + `numpy.random.seed(seed)`.
5. **No label leakage** — claim `status` derived post-label; not used as a feature.

## Analysis outputs

- `ml/reports/dataset_analysis/distribution_comparison.json`
- `ml/reports/dataset_analysis/class_balance_report.json`
- `ml/reports/dataset_analysis/correlation_analysis.json`
- `ml/reports/dataset_analysis/label_quality_comparison.json`
- `ml/reports/dataset_analysis/dataset_expansion_summary.md`

## Data honesty (FYP)

Training labels are rule-based teachers aligned with production heuristics. Metrics reflect learnability of those rules, not real-world claims approval rates. Production inference uses the same feature contract (`ml/data/schema.md`).
