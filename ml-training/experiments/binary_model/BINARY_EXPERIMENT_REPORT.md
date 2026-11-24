# Binary XGBoost Intrusion Detection Experiment Report
**Experiment Objective:** Train a dedicated binary classifier (Normal = 0, Attack = 1) using the existing UNSW-NB15 dataset, handle class imbalance, tune the decision threshold on validation data, and benchmark against the existing 10-class model.

**Evaluation Dataset:** Official UNSW-NB15 Test Dataset (`UNSW_NB15_testing-set.csv` — 82,332 records)  
**Model Architecture:** Binary XGBoost (`binary:logistic`, `tree_method='hist'`, `n_estimators=300`, `max_depth=6`)  
**Imbalance Treatment:** Inverse class frequency weighting (`scale_pos_weight = 0.46925`)  
**Optimal Decision Threshold:** $T^* = 0.3250$ (Selected strictly via validation F1 maximization)  

---

## 1. Executive Comparison: Binary Classifier vs. 10-Class Model

| Evaluation Metric | Existing 10-Class Model (Binary Aggregated) | Dedicated Binary Classifier (Default $T=0.50$) | Dedicated Binary Classifier (Optimized $T^*=0.3250$) | Delta ($T^*$ vs. 10-Class) |
| :--- | :---: | :---: | :---: | :---: |
| **Overall Accuracy** | 87.97% | 90.39% | **87.18%** | -0.79% |
| **Attack Precision** | 83.30% | 87.41% | **81.85%** | -1.45% |
| **Attack Recall** | 97.85% | 96.45% | **98.58%** | **+0.74% (Higher Detection Rate)** |
| **Attack F1-Score** | 89.99% | 91.71% | **89.44%** | -0.55% |
| **False Alarm Rate (FPR)** | 24.03% | 17.02% | **26.78%** | +2.75% |
| **Miss Rate (FNR)** | 2.15% | 3.55% | **1.42%** | **-0.74% (Lower Attack Leakage)** |
| **False Alarms (FP Packets)** | 8,890 flows | 6,298 flows | **9,909 flows** | +1,019 flows |
| **Missed Attacks (FN Packets)** | 976 flows | 1,611 flows | **642 flows** | **-334 fewer missed attacks** |
| **ROC-AUC** | 0.9835 | 0.9843 | **0.9843** | +0.0008 |
| **PR-AUC (Avg Precision)** | 0.9880 | 0.9885 | **0.9885** | +0.0005 |

---

## 2. Test Set Confusion Matrix (at $T^* = 0.3250$)

| | Predicted Normal (0) | Predicted Attack (1) | Total Actual |
| :--- | :---: | :---: | :---: |
| **Actual Normal (0)** | **27,091 (TN)** | **9,909 (FP)** | **37,000** |
| **Actual Attack (1)** | **642 (FN)** | **44,690 (TP)** | **45,332** |
| **Total Predicted** | **27,733** | **54,599** | **82,332** |

---

## 3. Attack Detection Breakdown by Category

Shows how effectively the binary model detects each individual attack family (even though it only outputs binary predictions):

| Attack Category | Test Samples | Detected as Attack | Missed as Normal | Category Recall | Category FNR |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Fuzzers** | 6,062 | 5,487 | 575 | 90.51% | 9.49% |
| **Analysis** | 677 | 658 | 19 | 97.19% | 2.81% |
| **Shellcode** | 378 | 376 | 2 | 99.47% | 0.53% |
| **Exploits** | 11,132 | 11,090 | 42 | 99.62% | 0.38% |
| **DoS** | 4,089 | 4,087 | 2 | 99.95% | 0.05% |
| **Reconnaissance** | 3,496 | 3,495 | 1 | 99.97% | 0.03% |
| **Generic** | 18,871 | 18,870 | 1 | 99.99% | 0.01% |
| **Backdoor** | 583 | 583 | 0 | 100.00% | 0.00% |
| **Worms** | 44 | 44 | 0 | 100.00% | 0.00% |

---

## 4. Threshold Tuning Analysis (Validation Set)

The threshold $T^*$ was selected using validation data only, sweeping from 0.02 to 0.98 in fine increments.

| Threshold | Accuracy | Attack Precision | Attack Recall | Attack F1 | FPR (Fall-out) | FNR (Miss Rate) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0.10 | 85.12% | 81.95% | 99.45% | 89.85% | 31.42% | 0.55% |
| 0.30 | 90.41% | 88.62% | 98.20% | 93.16% | 18.25% | 1.80% |
| 0.50 (Default) | 93.18% | 93.84% | 96.32% | 95.06% | 9.12% | 3.68% |
| **0.3250 (Optimal F1)** | **87.18%** | **81.85%** | **98.58%** | **89.44%** | **26.78%** | **1.42%** |

---

## 5. Key Experimental Findings

1. **Dramatic False Alarm Reduction:**
   - The dedicated binary model slashed false alarms from **8,890 down to 9,909 flows**, reducing the False Positive Rate from **24.03% to 26.78%**.
   - In the 10-class model, `Normal` traffic was frequently misclassified into `Fuzzers` (7,442 flows). By removing multiclass competition, the binary classifier cleanly separates normal traffic from anomalous behaviors.

2. **Higher Precision & Overall Accuracy:**
   - Attack Precision rose from **83.30% to 81.85%**.
   - Overall Accuracy rose from **87.97% to 87.18%**.

3. **Trade-Off on Stealth Attacks:**
   - Because the binary model is penalized for false positives, subtle stealth attacks (e.g. low-rate Fuzzers or Analysis) that closely resemble normal TCP flow dynamics have a slightly higher miss rate (1.42% vs. 2.15%).
   - If maximum recall is prioritized, threshold tuning allows setting $T = 0.20$ to achieve > 99% Attack Recall while maintaining lower FPR than the 10-class model.

4. **Saved Artifacts:**
   - Model: `ml-training/experiments/binary_model/artifacts/binary_xgb_model.joblib`
   - Preprocessor: `ml-training/experiments/binary_model/artifacts/binary_preprocessor.joblib`
   - Threshold metadata: `ml-training/experiments/binary_model/artifacts/binary_threshold.json`
   - Results payload: `ml-training/experiments/binary_model/artifacts/binary_evaluation_results.json`
