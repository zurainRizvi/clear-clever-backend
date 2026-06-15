# ClearClever ML Feature Schema

Shared contract between Python training (`ml/scripts/`) and Node inference (`clear-clever-backend/src/ml/`).

## Claim risk (`claim_risk_v1`)

| Feature | Type | Source |
|---------|------|--------|
| `claim_type` | categorical | `ClaimRequest.claimType` |
| `policy_category` | categorical | linked `Policy.category` |
| `estimated_amount_pkr` | numeric | `ClaimRequest.estimatedAmountPkr` (0 if missing) |
| `description_length` | numeric | `description.length` |
| `days_incident_to_submit` | numeric | `createdAt - incidentDate` in days |
| `amount_to_premium_ratio` | numeric | `estimatedAmountPkr / policy.premiumMonthlyPkr` |
| `user_claims_7d` | numeric | count of user's claims in last 7 days |
| `user_claims_30d` | numeric | count in last 30 days |
| `user_rejected_claims` | numeric | lifetime rejected claims for user |
| `city_region` | categorical | bucket from `Purchase.answers.city` |

**`city_region` values:** `punjab`, `sindh`, `kpk`, `balochistan`, `islamabad`, `other`

**Label:** `high_risk` (0/1) — synthetic rules from inference-time features only (`user_claims_7d`, `amount_to_premium_ratio`, `days_incident_to_submit`, `estimated_amount_pkr` + `policy_category`, `user_rejected_claims`). `status` is metadata derived post-label, not a model input.

**Export:** logistic regression + `StandardScaler` as JSON (`modelType: logistic_regression`).

---

## Fraud ML (`fraud_v1`)

| Feature | Type | Source |
|---------|------|--------|
| `signal_type` | categorical | mapped from `FraudSignal.type` |
| `fraud_category` | categorical | API tab: account / claims / commerce / catalog |
| `severity_encoded` | numeric | low=1 … critical=4 |
| `account_age_days` | numeric | inferred from signal id/type |
| `related_entity_count` | numeric | parsed from subject/detail counts |

**Label:** `fraudulent` (0/1) on semi-synthetic heuristic-aligned data.

**API fields:** `mlScore` (0–100), `mlFactors[]`, `mlSummary` per category response.

---

## Policy ranker (`policy_ranker_{category}_v1`)

Per-category (`home`, `auto`, `life`, `pet`) logistic regression exported as JSON.

| Feature | Type | Source |
|---------|------|--------|
| `user_value_pkr` | numeric | property / vehicle / income / pet weight proxy |
| `policy_premium_monthly_pkr` | numeric | `Policy.premiumMonthlyPkr` |
| `policy_feature_count` | numeric | `Policy.features.length` |
| `policy_deductible_pkr` | numeric | `Policy.deductiblePkr` |
| `premium_to_value_ratio` | numeric | yearly premium ÷ user value |
| `city_region` | categorical | bucket from city / registration city |
| category fields | categorical | `property_type`, `vehicle_type`, `coverage_goal`, `pet_type`, etc. |

**Label:** `label` (0/1) — positive policy from rule-based teacher (`scorePolicies`) on semi-synthetic journeys.

**Hybrid inference:** `finalScore = 0.3 * ruleScore + 0.7 * mlProbability * 100` in `hybridRecommendationService.ts`.
