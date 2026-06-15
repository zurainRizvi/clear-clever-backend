# Label Leakage Analysis — ClearClever ML

Audit date: 2026-06-11. Scope: claim risk, fraud detection, policy recommendation rankers.

## Summary

| Model | Leakage found | Severity | Resolution |
|-------|---------------|----------|------------|
| Claim risk | `status=rejected` used in label | **High** | Removed; `status` derived post-label |
| Claim risk | `user_rejected_claims` unused in rules | Low | Added `user_rejected_claims >= 2` |
| Fraud | None (heuristic distillation) | — | Documented |
| Policy ranker | Train/serve skew (`singleChoiceBonus` missing) | Medium | Ported to Python teacher |

---

## Claim risk (`high_risk`)

### Inference-time features (used by model)

From `claimFeatureBuilder.ts` / `schema.md`:

- `claim_type`, `policy_category`, `city_region`
- `estimated_amount_pkr`, `description_length`, `days_incident_to_submit`
- `amount_to_premium_ratio`, `user_claims_7d`, `user_claims_30d`, `user_rejected_claims`

### Excluded from model (correctly)

- `status` — post-hoc approval outcome
- `city` — raw city string (bucketed to `city_region`)

### Leakage (before fix)

**`status == "rejected"` → `high_risk = 1`**

- `status` was randomly assigned (~25% rejected), then fed into the label.
- The model never sees `status`, so rows labeled high-risk solely from rejection were **unlearnable**.
- Effect: inflated/noisy metrics and poor generalization on benign-looking features.

### Fix

1. Compute `high_risk` from inference-time features only.
2. Apply 8% label noise.
3. Derive `status` as synthetic metadata from `high_risk` (rejected/in_review for high-risk rows).

### Remaining label–feature overlap (intentional)

Threshold rules on `user_claims_7d`, `amount_to_premium_ratio`, `days_incident_to_submit`, `estimated_amount_pkr` + `policy_category`, `user_rejected_claims` — all available at submission time.

---

## Fraud detection (`fraudulent`)

### Inference-time features

- `signal_type`, `fraud_category`, `severity_encoded`, `account_age_days`, `related_entity_count`

### Assessment

Labels are a **deterministic function of the same features** used at inference. This is intentional **heuristic distillation** aligned with admin fraud heuristics — not classic leakage.

`severity` string duplicates `severity_encoded` in rule logic but only the encoded value is trained.

---

## Policy ranker (`label`)

### Inference-time features

Per-category numeric + categorical fields from questionnaire answers and policy metadata (`premium`, `feature_count`, `deductible`, `premium_to_value_ratio`).

### Train/serve skew (before fix)

Production `scorePolicies()` in `recommendationService.ts` adds `singleChoiceBonus()` (up to +5 pts) for questionnaire–policy feature alignment. Python `rule_score()` omitted this, causing label mismatch on edge cases.

### Fix

- Extended `policy_manifest.json` with `features[]` from `policySeedData.ts`.
- Ported `singleChoiceBonus()` token-matching heuristic into `generate_synthetic_recommendations.py`.

### Assessment

No feature leakage. Labels remain rule-distilled from features visible at ranking time.
