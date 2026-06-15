# Scalability and Future Migration

## Current scalability

| Layer | Scale | Notes |
|-------|-------|-------|
| Training | 10k–145k rows | Runs in <30s locally for LR; ranker on 145k pairs ~20s |
| Artifacts | ~21 KB JSON | Committed to backend repo; zero cold-start ML cost on Render |
| Inference | O(features) per prediction | Sigmoid on ~20–40 features; negligible vs MongoDB I/O |
| Render free tier | Compatible | No Python runtime; ML adds microseconds per request |

## Scaling paths

### Near term (FYP)

- Keep semi-synthetic teachers; document honestly in FYP report.
- Re-export artifacts after schema changes via `export_for_node.py`.
- CI gates: `claimRisk.test.ts`, `fraudMl.test.ts`, `hybridRecommendation.test.ts`.

### Medium term

- **Real Atlas exports** — `ml/scripts/export_atlas_training.py` pulls anonymized `MlTrainingSnapshot` rows; hybrid training via `export_for_node.py --data-source hybrid`.
- **Periodic retrain** — `.github/workflows/ml-retrain-monthly.yml` runs on the 1st of each month; super-admin promotes candidates in Admin → Health → ML.
- **Admin ML overview** — registry-backed active metrics, calibration charts, and retrain review panel.

### Long term options

| Option | When | Cost |
|--------|------|------|
| XGBoost + JSON trees | ROC-AUC +5pp on real data + <50KB export | New TS inference module |
| ONNX Runtime in Node | Benchmark proves LR insufficient + ONNX smaller than trees | Adds native dependency |
| Isolation Forest (fraud) | Unsupervised anomaly complement | Second artifact format |
| Python microservice | **Not planned** | Violates Render simplicity constraint |

## Migration strategy

1. **Do not migrate** until offline benchmark on production-like data exceeds 5pp ROC-AUC.
2. Prototype tree/ONNX inference in a branch; keep LR on `main`.
3. Version artifacts (`claim_risk_v2.json`) without breaking v1 loaders.
4. Optional Mem0/Qdrant for agent context — separate from tabular ML path.

## Monitoring

- Track `mlRisk` distribution in insurer claims review.
- Compare rule-only vs hybrid ranking click-through in discovery.
- Re-run `analyze_datasets.py` when regenerating data to catch distribution drift.
