# XGBoost Benchmark Report

Generated: 2026-06-11T01:06:35.877743+00:00

Offline benchmark only — production remains Logistic Regression JSON artifacts.

## claim_risk

| Metric | Logistic Regression | XGBoost | Delta |
|--------|--------------------:|--------:|------:|
| accuracy | 0.8245 | 0.9115 | +0.0870 |
| roc_auc | 0.8459 | 0.8538 | +0.0079 |
| precision | 0.6433 | 0.9100 | +0.2666 |
| recall | 0.7380 | 0.7342 | -0.0038 |
| f1 | 0.6874 | 0.8127 | +0.1253 |

**Top XGBoost features (gain, normalized):**
- user_rejected_claims: 0.6902
- user_claims_7d: 0.1619
- amount_to_premium_ratio: 0.0574
- estimated_amount_pkr: 0.0407
- days_incident_to_submit: 0.0238
- user_claims_30d: 0.0065
- description_length: 0.0038
- city_region__punjab: 0.0025

## fraud

| Metric | Logistic Regression | XGBoost | Delta |
|--------|--------------------:|--------:|------:|
| accuracy | 0.7945 | 0.9155 | +0.1210 |
| roc_auc | 0.8369 | 0.8457 | +0.0087 |
| precision | 0.9168 | 0.9174 | +0.0006 |
| recall | 0.8069 | 0.9786 | +0.1717 |
| f1 | 0.8583 | 0.9470 | +0.0887 |

**Top XGBoost features (gain, normalized):**
- related_entity_count: 0.4803
- severity_encoded: 0.3195
- account_age_days: 0.0541
- signal_type__claim_burst: 0.0403
- signal_type__lead_spike: 0.0390
- signal_type__duplicate_email: 0.0385
- signal_type__inactive_spike: 0.0035
- fraud_category__claims: 0.0033
