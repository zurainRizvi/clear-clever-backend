# Node.js Inference Architecture

## Loading pattern

Each model (`claimRiskModel.ts`, `fraudModel.ts`, `policyRankerModel.ts`):

1. Sync `fs.readFileSync` on first request
2. Parse JSON artifact into memory cache
3. `reset*Cache()` for Jest test isolation

Missing artifact → `null` → graceful fallback (no ML fields or rules-only ranking).

## Scoring pipeline (`featureEncoding.ts`)

```
raw features → one-hot encode → StandardScaler (mean/scale from JSON) → dot(coefficients) + intercept → sigmoid → probability
```

## API integration

| Flow | Service | Output fields |
|------|---------|---------------|
| Insurer claims | `claimRiskService.ts` | `mlRisk.level`, `mlRisk.score`, `mlRisk.topFactors` |
| Admin fraud | `fraudMlService.ts` | `mlScore` (0–100), `mlFactors`, `mlSummary` |
| Discovery | `hybridRecommendationService.ts` | Hybrid-ranked policies with `matchScore` |
| Admin dashboard | `adminMlOverviewService.ts` | Reads `*.meta.json` metrics |

## Claim risk level mapping

- `score = highRiskProbability × 100`
- `level` from `approvalProbability = 1 - highRiskProb`: low ≥0.65, medium ≥0.4, else high
- `topFactors`: top 3 by |scaled × coefficient|

## Tests

- `claimRisk.test.ts` — artifact load, scoring, API field presence
- `fraudMl.test.ts` — fraud signal enrichment
- `hybridRecommendation.test.ts` — hybrid blend determinism
