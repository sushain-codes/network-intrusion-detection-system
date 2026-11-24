# Detailed Model Evaluation Report: XGBoost Network Intrusion Detection
**Evaluated on:** Official UNSW-NB15 Test Dataset (`UNSW_NB15_testing-set.csv`)  
**Total Test Samples:** 82,332  
**Feature Count:** 42 raw network features  
**Class Count:** 10 classes (9 Attack Categories + Normal)  

---

## 1. Executive Summary & Metric Comparison

The model achieves strong overall accuracy and weighted performance, but demonstrates severe class-imbalance vulnerability on minority attack categories.

| Metric | Score | Percentage | Architectural Insight |
| :--- | :---: | :---: | :--- |
| **Overall Accuracy** | **0.7702** | **77.02%** | Dominated by majority classes (Normal & Generic). |
| **Weighted F1-Score** | **0.7818** | **78.18%** | Reflects population-weighted performance across the 82,332 test records. |
| **Macro F1-Score** | **0.5051** | **50.51%** | Unweighted average across all 10 classes; heavily penalized by minority attack classes. |
| **Micro F1-Score** | **0.7702** | **77.02%** | Global instance-level metric equivalent to accuracy. |

> **Key Takeaway on Metric Discrepancy:**  
> The **27.68% gap** between Weighted F1 (78.18%) and Macro F1 (50.51%) occurs because minority attack categories (*Analysis, Backdoor, Worms, Shellcode*) represent under 2% of the test set but receive equal (10%) weight in the macro average. While the model correctly handles the vast majority of network packets, it fails to recognize rare attacks.

---

## 2. Binary Evaluation: Normal vs. Malicious Traffic

In an intrusion detection system, detecting whether a packet is malicious (regardless of specific category) is the first line of defense.

* **Total Malicious Records (Positive):** 45,332 (55.06% of test set)
* **Total Normal Records (Negative):** 37,000 (44.94% of test set)

| Binary Detection Metric | Value | Security Impact |
| :--- | :---: | :--- |
| **Attack Recall (Detection Rate / TPR)** | **0.9785 (97.85%)** | Percentage of malicious packets detected as an attack. |
| **Attack False Negative Rate (Miss Rate / FNR)** | **0.0215 (2.15%)** | **976 attacks** slipped past the detector classified as benign. |
| **Attack Precision** | **0.8330 (83.30%)** | When an attack alert fires, probability it is truly malicious. |
| **Attack F1-Score** | **0.8999 (89.99%)** | Harmonic balance between detection and alert fidelity. |
| **False Positive Rate (False Alarm Rate / FPR)** | **0.2403 (24.03%)** | **8,890 benign packets** triggered false alerts. |
| **Normal Recall (Benign Specificity)** | **0.7597 (75.97%)** | Benign traffic successfully allowed through without alarm. |
| **Normal Precision** | **0.9664 (96.64%)** | When classified as normal, probability it is truly benign. |
| **Binary Classification Accuracy** | **0.8802 (88.02%)** | Overall binary discrimination rate. |

---

## 3. Area Under the Curve (AUC) Analysis

### Binary Discrimination (Attack vs. Normal)
* **Binary ROC-AUC:** **0.9835** (Excellent ranking capability across confidence thresholds)
* **Binary PR-AUC:** **0.9880** (Precision-Recall trade-off on attack positive class)

### Multiclass One-vs-Rest (OvR)
* **Macro-Averaged ROC-AUC:** **0.9637**
* **Weighted-Averaged ROC-AUC:** **0.9757**
* **Macro-Averaged PR-AUC:** **0.5708**
* **Weighted-Averaged PR-AUC:** **0.8704**

### Per-Class AUC Metrics
| Class | One-vs-Rest ROC-AUC | One-vs-Rest PR-AUC (Avg Precision) |
| :--- | :---: | :---: |
| **Analysis** | 0.9254 | 0.0472 |
| **Backdoor** | 0.9439 | 0.0991 |
| **DoS** | 0.9396 | 0.3954 |
| **Exploits** | 0.9674 | 0.8380 |
| **Fuzzers** | 0.8965 | 0.3604 |
| **Generic** | 0.9986 | 0.9969 |
| **Normal** | 0.9835 | 0.9791 |
| **Reconnaissance** | 0.9880 | 0.9061 |
| **Shellcode** | 0.9955 | 0.5505 |
| **Worms** | 0.9987 | 0.5348 |

---

## 4. Attack Misclassification into Normal Traffic (Sneak Attacks)

The most dangerous failure mode of an IDS is classifying an active cyberattack as **Normal** traffic. Below is the full breakdown of attacks that slipped through the system as benign:

| Rank | Attack Category | Actual Records | Slipped to Normal | % Slipped to Normal | Detected as Any Attack | Overall Detection Rate |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | **Fuzzers** | 6,062 | 732 | **12.08%** | 5,330 | 87.92% |
| 2 | **Analysis** | 677 | 44 | **6.50%** | 633 | 93.50% |
| 3 | **DoS** | 4,089 | 51 | **1.25%** | 4,038 | 98.75% |
| 4 | **Backdoor** | 583 | 7 | **1.20%** | 576 | 98.80% |
| 5 | **Shellcode** | 378 | 4 | **1.06%** | 374 | 98.94% |
| 6 | **Exploits** | 11,132 | 117 | **1.05%** | 11,015 | 98.95% |
| 7 | **Reconnaissance** | 3,496 | 9 | **0.26%** | 3,487 | 99.74% |
| 8 | **Generic** | 18,871 | 12 | **0.06%** | 18,859 | 99.94% |
| 9 | **Worms** | 44 | 0 | **0.00%** | 44 | 100.00% |

> **Critical Findings:**
> 1. **Backdoor attacks are the most stealthy:** **84.39% (492 of 583)** of all Backdoor connections were misclassified as Normal traffic.
> 2. **Analysis and Fuzzers have alarming leakage:** **51.26%** of Analysis attacks and **41.16% (2,495 packets)** of Fuzzers slipped past as normal traffic.
> 3. **High absolute packet leakage in DoS & Fuzzers:** While DoS has a lower percentage leakage (12.72%), **520 DoS attack flows** were completely missed as Normal. Combined with Fuzzers, over 3,000 volumetric/probing attacks breached benign boundaries.
> 4. **Generic attacks are near-immune to leakage:** Only **0.17% (33 of 18,871)** of Generic attacks were marked Normal, demonstrating that high-volume signature-based attacks are easily partitioned from normal traffic.

---

## 5. Per-Class Performance and Error Breakdown (One-vs-Rest)

| Class | Support | TP | FP | FN | Precision | Recall | Specificity | F1-Score | FNR (Miss) | FPR (Fall-out) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Analysis** | 677 | 14 | 960 | 663 | 0.0144 | 0.0207 | 0.9882 | 0.0170 | 97.93% | 1.18% |
| **Backdoor** | 583 | 83 | 1,522 | 500 | 0.0517 | 0.1424 | 0.9814 | 0.0759 | 85.76% | 1.86% |
| **DoS** | 4,089 | 373 | 242 | 3,716 | 0.6065 | 0.0912 | 0.9969 | 0.1586 | 90.88% | 0.31% |
| **Exploits** | 11,132 | 9,774 | 6,766 | 1,358 | 0.5909 | 0.8780 | 0.9050 | 0.7064 | 12.20% | 9.50% |
| **Fuzzers** | 6,062 | 3,621 | 7,698 | 2,441 | 0.3199 | 0.5973 | 0.8991 | 0.4167 | 40.27% | 10.09% |
| **Generic** | 18,871 | 18,308 | 40 | 563 | 0.9978 | 0.9702 | 0.9994 | 0.9838 | 2.98% | 0.06% |
| **Normal** | 37,000 | 28,110 | 976 | 8,890 | 0.9664 | 0.7597 | 0.9785 | 0.8507 | 24.03% | 2.15% |
| **Reconnaissance** | 3,496 | 2,827 | 211 | 669 | 0.9305 | 0.8086 | 0.9973 | 0.8653 | 19.14% | 0.27% |
| **Shellcode** | 378 | 288 | 492 | 90 | 0.3692 | 0.7619 | 0.9940 | 0.4974 | 23.81% | 0.60% |
| **Worms** | 44 | 17 | 10 | 27 | 0.6296 | 0.3864 | 0.9999 | 0.4789 | 61.36% | 0.01% |

---

## 6. Confusion Matrix (10x10)

Rows correspond to the **Actual Ground-Truth Class**; columns correspond to the **Predicted Class**.

| True \ Pred | Analysis | Backdoor | DoS | Exploits | Fuzzers | Generic | Normal | Reconnaissance | Shellcode | Worms | Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Analysis** | 14 | 83 | 11 | 525 | 0 | 0 | 44 | 0 | 0 | 0 | **677** |
| **Backdoor** | 14 | 83 | 12 | 461 | 2 | 0 | 7 | 0 | 4 | 0 | **583** |
| **DoS** | 159 | 604 | 373 | 2,785 | 40 | 8 | 51 | 22 | 47 | 0 | **4,089** |
| **Exploits** | 167 | 591 | 86 | 9,774 | 119 | 23 | 117 | 172 | 79 | 4 | **11,132** |
| **Fuzzers** | 46 | 168 | 39 | 1,254 | 3,621 | 4 | 732 | 7 | 191 | 0 | **6,062** |
| **Generic** | 0 | 4 | 38 | 438 | 45 | 18,308 | 12 | 0 | 21 | 5 | **18,871** |
| **Normal** | 555 | 0 | 41 | 710 | 7,442 | 3 | 28,110 | 9 | 129 | 1 | **37,000** |
| **Reconnaissance** | 19 | 72 | 12 | 525 | 12 | 1 | 9 | 2,827 | 19 | 0 | **3,496** |
| **Shellcode** | 0 | 0 | 3 | 45 | 37 | 0 | 4 | 1 | 288 | 0 | **378** |
| **Worms** | 0 | 0 | 0 | 23 | 1 | 1 | 0 | 0 | 2 | 17 | **44** |
| **Total Predicted** | 974 | 1,605 | 615 | 16,540 | 11,319 | 18,348 | 29,086 | 3,038 | 780 | 27 | **82,332** |

---

## 7. Comprehensive Root-Cause Analysis of Model Weaknesses

### Weakness 1: Severe Multiclass Confusion & "Exploits" Aggregation Sink
* **DoS Collapse (Recall: 9.12%):** Out of 4,089 true DoS attacks, only 373 were classified as DoS. An overwhelming **2,785 DoS attacks (68.11%)** were misclassified as `Exploits`, and **604 (14.77%)** were misclassified as `Backdoor`.
* **Analysis Collapse (Recall: 2.07%):** Out of 677 Analysis attacks, only 14 were identified (F1 = 0.0170). **525 (77.55%)** were misclassified as `Exploits`.
* **Backdoor Collapse (Recall: 14.24%):** Out of 583 Backdoor attacks, only 83 were identified (F1 = 0.0759). **461 (79.07%)** were misclassified as `Exploits`.
* **Exploits as an Aggregator Sink:** `Exploits` serves as a massive attractor in feature space, predicting 16,540 packets as Exploits (with **6,766 False Positives**). It absorbs misclassifications across DoS (2,785), Fuzzers (1,254), Reconnaissance (525), Analysis (525), Backdoor (461), Normal (710), and Generic (438), reducing its precision to **59.09%**.

### Weakness 2: High False Positive Alarm Rate on Benign Traffic (Normal -> Fuzzers)
* **7,442 Benign Packets Falsely Flagged as Fuzzers:** Out of 37,000 Normal flows, **7,442 (20.11%)** were falsely predicted as `Fuzzers`, plus 710 as `Exploits` and 555 as `Analysis`.
* **Total False Alarm Rate (FPR):** **24.03% (8,890 benign flows alarmed as attacks)**.
* **Fuzzers Precision Degradation:** Because of the 7,442 false alarms from Normal traffic, `Fuzzers` precision drops to **31.99%** (7,698 False Positives against 3,621 True Positives). In production SOC operations, this volume of false alarms would cause critical alert fatigue.

### Weakness 3: Attack Leakage into Normal Traffic (Sneak Attacks)
* **976 Malicious Flows Classified as Normal (FNR: 2.15%):**
  - **Fuzzers:** **732 flows (12.08% of all Fuzzers)** slipped past the detector as benign Normal.
  - **Exploits:** **117 flows (1.05%)** slipped past as Normal.
  - **DoS:** **51 flows (1.25%)** slipped past as Normal.
  - **Analysis:** **44 flows (6.50%)** slipped past as Normal.
* **Impact:** While binary attack recall is high (97.85%), stealthy payload-fuzzing and probing attacks that mimic standard TCP/UDP request patterns successfully evade detection.

### Weakness 4: The 27.68% Macro vs. Weighted F1 Gap (Imbalance Pathology)
* **Weighted F1 (78.18%) vs. Macro F1 (50.51%):**
  - High-frequency classes perform strongly: `Generic` (F1 = 0.9838, support 18,871), `Normal` (F1 = 0.8507, support 37,000), `Reconnaissance` (F1 = 0.8653, support 3,496).
  - Low-frequency classes fail almost completely: `Analysis` (F1 = 0.0170), `Backdoor` (F1 = 0.0759), `DoS` (F1 = 0.1586), `Fuzzers` (F1 = 0.4167), `Worms` (F1 = 0.4789), `Shellcode` (F1 = 0.4974).
  - Because Macro F1 gives equal (10%) weight to every class, the model's inability to isolate rare cyberattack signatures severely depresses its unweighted score.

---

## 8. Concrete Recommendations for Production Hardening

1. **Two-Stage Hierarchical Classification Architecture:**
   - **Stage 1 (Binary Firewall Gate):** A dedicated binary classifier tuned for >= 99.5% attack recall (False Negative Rate < 0.5%).
   - **Stage 2 (Fine-Grained Triage Engine):** Multi-class specialist classifiers activated only on traffic flagged as non-benign by Stage 1.
2. **Cost-Sensitive Learning & Specialized Loss Functions:**
   - Retrain with inverse class weights or Focal Loss to heavily penalize misclassification of rare classes (`Analysis`, `Backdoor`, `Worms`).
3. **Threshold Calibration & Class-Specific Cutoffs:**
   - Instead of default `argmax`, apply risk-weighted decision thresholds: e.g., flag `Backdoor` if P(Backdoor) > 0.08, preventing stealth malware from going unnoticed.
4. **Targeted Resampling (SMOTE-ENN / Borderline-SMOTE):**
   - Synthetically oversample minority attack classes in feature space before training to improve tree split decisions on underrepresented attack manifolds.
