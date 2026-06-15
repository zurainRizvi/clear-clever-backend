# Model Evaluation Results

Baseline: 2026-06-09 artifacts (4k/3k/2.5k-journey data, leaky claim labels).  
Retrained: 2026-06-11 (10k data, leakage fixed, aligned ranker teacher).

Source: `ml/reports/model_comparison.json`

## Claim risk

| Metric | Baseline | Retrained | Delta |
|--------|----------|-----------|-------|
| Accuracy | 0.726 | 0.825 | +9.8pp |
| ROC-AUC | 0.787 | 0.846 | +5.9pp |
| Precision | 0.758 | 0.643 | −11.5pp |
| Recall | 0.706 | 0.738 | +3.2pp |
| F1 | 0.731 | 0.687 | −4.4pp |
| Train rows | 3,200 | 8,000 | — |
| Test rows | 800 | 2,000 | — |

Confusion matrix (retrained): TN=1263, FP=214, FN=137, TP=386

## Fraud detection

| Metric | Baseline | Retrained | Delta |
|--------|----------|-----------|-------|
| Accuracy | 0.710 | 0.795 | +8.5pp |
| ROC-AUC | 0.771 | 0.837 | +6.6pp |
| Precision | 0.908 | 0.917 | +0.9pp |
| Recall | 0.713 | 0.807 | +9.4pp |
| F1 | 0.799 | 0.858 | +5.9pp |
| Train rows | 2,400 | 8,000 | — |
| Test rows | 600 | 2,000 | — |

Confusion matrix (retrained): TN=344, FP=113, FN=298, TP=1245

## Policy rankers (retrained highlights)

| Category | Accuracy | ROC-AUC | Precision | Recall | F1 |
|----------|----------|---------|-----------|--------|-----|
| home | 0.929 | 0.989 | 0.503 | 1.000 | 0.669 |
| auto | 0.942 | 0.991 | 0.506 | 0.994 | 0.670 |
| life | 0.922 | 0.986 | 0.498 | 1.000 | 0.664 |
| pet | 0.935 | 0.985 | 0.524 | 0.962 | 0.678 |

Rankers show high recall (one positive per journey) with moderate precision due to class imbalance.

## Key takeaway

Removing claim-status leakage and expanding data improved **ROC-AUC and recall** for claim risk and fraud despite lower claim-risk precision — a healthier trade-off for risk flagging.
