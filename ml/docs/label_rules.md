# Label Generation Rules — ClearClever ML

Documented rules for semi-synthetic teacher labels. All generators use fixed seeds for reproducibility.

| Dataset | Seed | Default size |
|---------|------|--------------|
| Claims | 42 | 10,000 rows |
| Fraud | 7 | 10,000 rows |
| Recommendations | 99 | 10,000 journeys |

---

## Claim risk — `high_risk` (0/1)

### Before (leaky)

```
high_risk = 0
if user_claims_7d >= 3:        high_risk = 1
if amount_to_premium_ratio > 80: high_risk = 1
if days_incident_to_submit > 30: high_risk = 1
if estimated > 500_000 AND policy_category == "pet": high_risk = 1
if status == "rejected":        high_risk = 1   # LEAKAGE — removed
if random() < 0.08:             high_risk = 1 - high_risk
status = random(approved|rejected|in_review|submitted)
```

### After (inference-aligned)

```
high_risk = 0
if user_claims_7d >= 3:              high_risk = 1
if amount_to_premium_ratio > 80:     high_risk = 1
if days_incident_to_submit > 30:     high_risk = 1
if estimated > 500_000 AND policy_category == "pet": high_risk = 1
if user_rejected_claims >= 2:        high_risk = 1   # NEW
if random() < 0.08:                  high_risk = 1 - high_risk

# status derived AFTER label (metadata only):
if high_risk:
  status = weighted_choice(rejected 55%, in_review 30%, submitted 15%)
else:
  status = weighted_choice(approved 70%, submitted 20%, in_review 10%)
```

### Feature correlations (generation)

- `estimated_amount_pkr` drawn from claim-type-specific lognormal parameters.
- `days_incident_to_submit` increases with claim amount.
- `user_rejected_claims` elevated when `user_claims_7d >= 3`.
- `policy_category` biased by `claim_type`.

---

## Fraud detection — `fraudulent` (0/1)

Unchanged rule logic; improved feature correlations.

```
fraudulent = 0
if signal_type in (duplicate_email, claim_burst, lead_spike): fraudulent = 1
if severity in (high, critical):                              fraudulent = 1
if related_entity_count >= 12:                                fraudulent = 1
if account_age_days <= 30 AND signal_type == duplicate_email:  fraudulent = 1
if random() < 0.08:                                           fraudulent = 1 - fraudulent
```

### Feature correlations

- Burst/high-severity signals → higher `related_entity_count`.
- Account/commerce categories → younger `account_age_days` distribution.

---

## Policy ranker — `label` (0/1)

One positive policy per journey (85% top-1, 15% top-2 from rule ranking).

### Rule score (aligned with production `scorePolicies`)

```
score = affordability (0–40)
      + coverage_fit (0–35)    # yearly_premium / user_value in [0.8%, 2.5%] band
      + feature_richness (0–25)
      + single_choice_bonus (0–5)   # NEW — token match answers vs policy.features[]
```

Positive label: `label = 1` iff `policy_slug == top_scored_policy`.

---

## Before/after label distribution

See `ml/reports/dataset_analysis/label_quality_comparison.json`.
