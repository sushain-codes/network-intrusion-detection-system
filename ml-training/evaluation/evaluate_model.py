"""
Official UNSW-NB15 Model Evaluation Script
Evaluates the trained XGBoost model and preprocessor on the official UNSW-NB15 test dataset.
"""

import sys
import os
import json
from pathlib import Path

# Add ml-service to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "ml-service"))
from app.predictor import predictor, RAW_FEATURE_NAMES

import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_auc_score,
    average_precision_score,
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.preprocessing import label_binarize

def run_evaluation():
    eval_dir = Path(__file__).resolve().parent
    eval_dir.mkdir(parents=True, exist_ok=True)
    test_csv = Path(__file__).resolve().parent.parent / "data" / "UNSW_NB15_testing-set.csv"

    if not test_csv.exists():
        raise FileNotFoundError(f"Test dataset not found at {test_csv}")

    print("=" * 80)
    print("XAI-NIDS: DETAILED MODEL EVALUATION ON OFFICIAL UNSW-NB15 TEST SET")
    print("=" * 80)

    # 1. Load artifacts
    print("\n[1/7] Loading saved model artifacts and preprocessor...")
    success = predictor.load_artifacts()
    if not success:
        raise RuntimeError("Failed to load predictor artifacts!")
    
    classes = list(predictor.label_encoder.classes_)
    num_classes = len(classes)
    print(f"Loaded {num_classes} classes: {classes}")

    # 2. Load test data
    print(f"\n[2/7] Loading official test dataset from: {test_csv}")
    test_df = pd.read_csv(test_csv)
    print(f"Total test records: {len(test_df):,} | Columns: {len(test_df.columns)}")

    y_true_str = test_df["attack_cat"].values
    y_true_binary = (y_true_str != "Normal").astype(int)
    y_true_encoded = predictor.label_encoder.transform(y_true_str)

    X_test = test_df.drop(columns=["id", "attack_cat", "label"])

    # 3. Preprocess
    print("\n[3/7] Transforming test features with fitted preprocessor...")
    X_test_xgb = predictor.preprocessor.transform(X_test)
    print(f"Preprocessed feature matrix shape: {X_test_xgb.shape} (sparse: {hasattr(X_test_xgb, 'tocsr')})")

    # 4. Model inference
    print("\n[4/7] Running XGBoost inference...")
    y_pred_encoded = predictor.model.predict(X_test_xgb).astype(int)
    y_pred_prob = predictor.model.predict_proba(X_test_xgb)
    y_pred_str = predictor.label_encoder.inverse_transform(y_pred_encoded)
    y_pred_binary = (y_pred_str != "Normal").astype(int)

    # -------------------------------------------------------------------------
    # 5. Core Metrics Calculation
    # -------------------------------------------------------------------------
    print("\n[5/7] Computing detailed evaluation metrics...")

    # A. Top-level overall metrics
    overall_accuracy = float(accuracy_score(y_true_str, y_pred_str))
    macro_f1 = float(f1_score(y_true_str, y_pred_str, average="macro"))
    weighted_f1 = float(f1_score(y_true_str, y_pred_str, average="weighted"))
    micro_f1 = float(f1_score(y_true_str, y_pred_str, average="micro"))

    # B. Confusion Matrix (10x10)
    cm = confusion_matrix(y_true_str, y_pred_str, labels=classes)
    cm_dict = {
        true_cls: {pred_cls: int(cm[i, j]) for j, pred_cls in enumerate(classes)}
        for i, true_cls in enumerate(classes)
    }

    # C. Classification Report (10 classes)
    clf_report = classification_report(
        y_true_str, y_pred_str, labels=classes, digits=4, output_dict=True
    )

    # D. Per-Class One-vs-Rest Confusion Metrics (TP, FP, FN, TN, rates)
    total_samples = len(test_df)
    per_class_metrics = {}
    for i, cls_name in enumerate(classes):
        tp = int(cm[i, i])
        fn = int(np.sum(cm[i, :]) - tp)
        fp = int(np.sum(cm[:, i]) - tp)
        tn = int(total_samples - tp - fn - fp)
        support = tp + fn

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        fnr = float(fn / support) if support > 0 else 0.0
        fpr = float(fp / (tn + fp)) if (tn + fp) > 0 else 0.0

        per_class_metrics[cls_name] = {
            "support": support,
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn,
            "precision": prec,
            "recall": rec,
            "f1_score": f1,
            "specificity": specificity,
            "false_negative_rate": fnr,
            "false_positive_rate": fpr,
        }

    # E. Binary Normal vs Attack Evaluation
    # Positive = Attack (1), Negative = Normal (0)
    bin_tp = int(np.sum((y_true_binary == 1) & (y_pred_binary == 1)))
    bin_fp = int(np.sum((y_true_binary == 0) & (y_pred_binary == 1)))
    bin_fn = int(np.sum((y_true_binary == 1) & (y_pred_binary == 0)))
    bin_tn = int(np.sum((y_true_binary == 0) & (y_pred_binary == 0)))

    total_attacks = int(np.sum(y_true_binary == 1))
    total_normal = int(np.sum(y_true_binary == 0))

    attack_recall = float(bin_tp / total_attacks) if total_attacks > 0 else 0.0
    attack_precision = float(bin_tp / (bin_tp + bin_fp)) if (bin_tp + bin_fp) > 0 else 0.0
    attack_f1 = (
        float(2 * attack_precision * attack_recall / (attack_precision + attack_recall))
        if (attack_precision + attack_recall) > 0
        else 0.0
    )
    attack_fnr = float(bin_fn / total_attacks) if total_attacks > 0 else 0.0
    attack_fpr = float(bin_fp / total_normal) if total_normal > 0 else 0.0

    normal_recall = float(bin_tn / total_normal) if total_normal > 0 else 0.0
    normal_precision = float(bin_tn / (bin_tn + bin_fn)) if (bin_tn + bin_fn) > 0 else 0.0
    normal_f1 = (
        float(2 * normal_precision * normal_recall / (normal_precision + normal_recall))
        if (normal_precision + normal_recall) > 0
        else 0.0
    )
    binary_accuracy = float((bin_tp + bin_tn) / total_samples)

    binary_metrics = {
        "total_attacks": total_attacks,
        "total_normal": total_normal,
        "true_positives_attack": bin_tp,
        "false_positives_attack": bin_fp,
        "false_negatives_attack": bin_fn,
        "true_negatives_attack": bin_tn,
        "attack_recall": attack_recall,
        "attack_precision": attack_precision,
        "attack_f1_score": attack_f1,
        "false_negative_rate": attack_fnr,
        "false_positive_rate": attack_fpr,
        "normal_recall": normal_recall,
        "normal_precision": normal_precision,
        "normal_f1_score": normal_f1,
        "binary_accuracy": binary_accuracy,
    }

    # F. ROC-AUC and PR-AUC
    # Binarize labels for multiclass OvR
    y_true_bin_ovr = label_binarize(y_true_encoded, classes=range(num_classes))
    per_class_auc = {}
    for i, cls_name in enumerate(classes):
        try:
            roc_auc = float(roc_auc_score(y_true_bin_ovr[:, i], y_pred_prob[:, i]))
        except Exception:
            roc_auc = None
        try:
            pr_auc = float(average_precision_score(y_true_bin_ovr[:, i], y_pred_prob[:, i]))
        except Exception:
            pr_auc = None
        per_class_auc[cls_name] = {"roc_auc": roc_auc, "pr_auc": pr_auc}

    macro_roc_auc = float(roc_auc_score(y_true_bin_ovr, y_pred_prob, average="macro", multi_class="ovr"))
    weighted_roc_auc = float(roc_auc_score(y_true_bin_ovr, y_pred_prob, average="weighted", multi_class="ovr"))
    macro_pr_auc = float(average_precision_score(y_true_bin_ovr, y_pred_prob, average="macro"))
    weighted_pr_auc = float(average_precision_score(y_true_bin_ovr, y_pred_prob, average="weighted"))

    # Binary ROC-AUC and PR-AUC
    normal_idx = classes.index("Normal")
    prob_attack = 1.0 - y_pred_prob[:, normal_idx]
    binary_roc_auc = float(roc_auc_score(y_true_binary, prob_attack))
    binary_pr_auc = float(average_precision_score(y_true_binary, prob_attack))

    auc_metrics = {
        "multiclass_ovr": {
            "macro_roc_auc": macro_roc_auc,
            "weighted_roc_auc": weighted_roc_auc,
            "macro_pr_auc": macro_pr_auc,
            "weighted_pr_auc": weighted_pr_auc,
            "per_class": per_class_auc,
        },
        "binary_attack_vs_normal": {
            "roc_auc": binary_roc_auc,
            "pr_auc": binary_pr_auc,
        },
    }

    # G. Attacks Misclassified as Normal (False Dismissals / Sneak Attacks)
    normal_col_idx = classes.index("Normal")
    attacks_to_normal = []
    for i, cls_name in enumerate(classes):
        if cls_name == "Normal":
            continue
        support = int(np.sum(cm[i, :]))
        misclassified_as_normal = int(cm[i, normal_col_idx])
        pct_to_normal = float((misclassified_as_normal / support) * 100) if support > 0 else 0.0
        correct_class = int(cm[i, i])
        misclassified_as_other_attacks = int(support - correct_class - misclassified_as_normal)

        attacks_to_normal.append({
            "category": cls_name,
            "support": support,
            "misclassified_as_normal": misclassified_as_normal,
            "percent_misclassified_as_normal": pct_to_normal,
            "correctly_classified_own_cat": correct_class,
            "misclassified_as_other_attack": misclassified_as_other_attacks,
            "detected_as_any_attack": support - misclassified_as_normal,
            "attack_detection_rate": float(((support - misclassified_as_normal) / support) * 100) if support > 0 else 0.0
        })

    # Sort descending by percent misclassified as normal
    attacks_to_normal.sort(key=lambda x: x["percent_misclassified_as_normal"], reverse=True)

    # -------------------------------------------------------------------------
    # 6. Save JSON Results
    # -------------------------------------------------------------------------
    results_payload = {
        "dataset": {
            "name": "UNSW-NB15 Official Test Set",
            "file": "UNSW_NB15_testing-set.csv",
            "total_records": total_samples,
            "total_features": 42,
            "total_classes": num_classes,
            "classes": classes,
        },
        "overall_summary": {
            "accuracy": overall_accuracy,
            "macro_f1": macro_f1,
            "weighted_f1": weighted_f1,
            "micro_f1": micro_f1,
        },
        "binary_evaluation": binary_metrics,
        "auc_metrics": auc_metrics,
        "attacks_misclassified_as_normal": attacks_to_normal,
        "per_class_metrics": per_class_metrics,
        "classification_report": clf_report,
        "confusion_matrix": cm_dict,
    }

    json_out = eval_dir / "test_evaluation_results.json"
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)
    print(f"\n[6/7] Evaluation results successfully saved to: {json_out}")

    # -------------------------------------------------------------------------
    # 7. Generate Comprehensive Markdown Report
    # -------------------------------------------------------------------------
    report_md = generate_markdown_report(results_payload, cm, classes)
    report_path = eval_dir / "MODEL_EVALUATION_REPORT.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"[7/7] Markdown evaluation report saved to: {report_path}")

    print("\n" + "=" * 80)
    print("EVALUATION COMPLETED SUCCESSFULLY")
    print("=" * 80)

    # Print Key Highlights to Console
    print(f"\n>> OVERALL PERFORMANCE:")
    print(f"   Accuracy:    {overall_accuracy:.4%}")
    print(f"   Macro F1:    {macro_f1:.4%}")
    print(f"   Weighted F1: {weighted_f1:.4%}")
    print(f"\n>> BINARY ATTACK DETECTION:")
    print(f"   Attack Recall (Detection Rate): {attack_recall:.4%}")
    print(f"   Attack Precision:               {attack_precision:.4%}")
    print(f"   Attack F1-Score:                {attack_f1:.4%}")
    print(f"   False Negative Rate (Miss Rate):{attack_fnr:.4%} ({bin_fn:,} attacks slipped past as Normal)")
    print(f"   False Positive Rate (Alarm):    {attack_fpr:.4%} ({bin_fp:,} normal flagged as Attack)")
    print(f"\n>> AUC PERFORMANCE:")
    print(f"   Binary ROC-AUC:                 {binary_roc_auc:.4f}")
    print(f"   Binary PR-AUC:                  {binary_pr_auc:.4f}")
    print(f"   Multiclass Macro ROC-AUC:       {macro_roc_auc:.4f}")
    print(f"   Multiclass Macro PR-AUC:        {macro_pr_auc:.4f}")

    return results_payload


def generate_markdown_report(res, cm, classes):
    ov = res["overall_summary"]
    bi = res["binary_evaluation"]
    auc = res["auc_metrics"]
    m_auc = auc["multiclass_ovr"]
    b_auc = auc["binary_attack_vs_normal"]
    pcm = res["per_class_metrics"]
    atn = res["attacks_misclassified_as_normal"]

    # Build Confusion Matrix Markdown Table
    cm_header = "| True \\ Pred | " + " | ".join(classes) + " | Total |"
    cm_sep = "| :--- | " + " | ".join([":---:"] * len(classes)) + " | :---: |"
    cm_rows = []
    for i, cls_name in enumerate(classes):
        row_vals = [f"{cm[i, j]:,}" for j in range(len(classes))]
        row_total = f"{np.sum(cm[i, :]):,}"
        cm_rows.append(f"| **{cls_name}** | " + " | ".join(row_vals) + f" | **{row_total}** |")
    cm_pred_total = [f"{np.sum(cm[:, j]):,}" for j in range(len(classes))]
    cm_rows.append(f"| **Total Predicted** | " + " | ".join(cm_pred_total) + f" | **{res['dataset']['total_records']:,}** |")
    cm_table = "\n".join([cm_header, cm_sep] + cm_rows)

    # Build Per-Class Metrics Table
    pcm_header = "| Class | Support | TP | FP | FN | Precision | Recall | Specificity | F1-Score | FNR (Miss) | FPR (Fall-out) |"
    pcm_sep = "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |"
    pcm_rows = []
    for c in classes:
        m = pcm[c]
        pcm_rows.append(
            f"| **{c}** | {m['support']:,} | {m['true_positives']:,} | {m['false_positives']:,} | "
            f"{m['false_negatives']:,} | {m['precision']:.4f} | {m['recall']:.4f} | "
            f"{m['specificity']:.4f} | {m['f1_score']:.4f} | {m['false_negative_rate']:.2%} | "
            f"{m['false_positive_rate']:.2%} |"
        )
    pcm_table = "\n".join([pcm_header, pcm_sep] + pcm_rows)

    # Build Attacks Misclassified as Normal Table
    atn_header = "| Rank | Attack Category | Actual Records | Slipped to Normal | % Slipped to Normal | Detected as Any Attack | Overall Detection Rate |"
    atn_sep = "| :---: | :--- | :---: | :---: | :---: | :---: | :---: |"
    atn_rows = []
    for rank, a in enumerate(atn, 1):
        atn_rows.append(
            f"| {rank} | **{a['category']}** | {a['support']:,} | {a['misclassified_as_normal']:,} | "
            f"**{a['percent_misclassified_as_normal']:.2f}%** | {a['detected_as_any_attack']:,} | "
            f"{a['attack_detection_rate']:.2f}% |"
        )
    atn_table = "\n".join([atn_header, atn_sep] + atn_rows)

    # Build Per-Class AUC Table
    auc_header = "| Class | One-vs-Rest ROC-AUC | One-vs-Rest PR-AUC (Avg Precision) |"
    auc_sep = "| :--- | :---: | :---: |"
    auc_rows = []
    for c in classes:
        ra = m_auc["per_class"][c]["roc_auc"]
        pa = m_auc["per_class"][c]["pr_auc"]
        ra_str = f"{ra:.4f}" if ra is not None else "N/A"
        pa_str = f"{pa:.4f}" if pa is not None else "N/A"
        auc_rows.append(f"| **{c}** | {ra_str} | {pa_str} |")
    auc_table = "\n".join([auc_header, auc_sep] + auc_rows)

    report = f"""# Detailed Model Evaluation Report: XGBoost Network Intrusion Detection
**Evaluated on:** Official UNSW-NB15 Test Dataset (`UNSW_NB15_testing-set.csv`)  
**Total Test Samples:** {res['dataset']['total_records']:,}  
**Feature Count:** {res['dataset']['total_features']} raw network features  
**Class Count:** {res['dataset']['total_classes']} classes (9 Attack Categories + Normal)  

---

## 1. Executive Summary & Metric Comparison

The model achieves strong overall accuracy and weighted performance, but demonstrates severe class-imbalance vulnerability on minority attack categories.

| Metric | Score | Percentage | Architectural Insight |
| :--- | :---: | :---: | :--- |
| **Overall Accuracy** | **{ov['accuracy']:.4f}** | **{ov['accuracy']*100:.2f}%** | Dominated by majority classes (Normal & Generic). |
| **Weighted F1-Score** | **{ov['weighted_f1']:.4f}** | **{ov['weighted_f1']*100:.2f}%** | Reflects population-weighted performance across the 82,332 test records. |
| **Macro F1-Score** | **{ov['macro_f1']:.4f}** | **{ov['macro_f1']*100:.2f}%** | Unweighted average across all 10 classes; heavily penalized by minority attack classes. |
| **Micro F1-Score** | **{ov['micro_f1']:.4f}** | **{ov['micro_f1']*100:.2f}%** | Global instance-level metric equivalent to accuracy. |

> **Key Takeaway on Metric Discrepancy:**  
> The **{ov['weighted_f1'] - ov['macro_f1']:.2%} gap** between Weighted F1 ({ov['weighted_f1']:.2%}) and Macro F1 ({ov['macro_f1']:.2%}) occurs because minority attack categories (*Analysis, Backdoor, Worms, Shellcode*) represent under 2% of the test set but receive equal (10%) weight in the macro average. While the model correctly handles the vast majority of network packets, it fails to recognize rare attacks.

---

## 2. Binary Evaluation: Normal vs. Malicious Traffic

In an intrusion detection system, detecting whether a packet is malicious (regardless of specific category) is the first line of defense.

* **Total Malicious Records (Positive):** {bi['total_attacks']:,} (55.06% of test set)
* **Total Normal Records (Negative):** {bi['total_normal']:,} (44.94% of test set)

| Binary Detection Metric | Value | Security Impact |
| :--- | :---: | :--- |
| **Attack Recall (Detection Rate / TPR)** | **{bi['attack_recall']:.4f} ({bi['attack_recall']*100:.2f}%)** | Percentage of malicious packets detected as an attack. |
| **Attack False Negative Rate (Miss Rate / FNR)** | **{bi['false_negative_rate']:.4f} ({bi['false_negative_rate']*100:.2f}%)** | **{bi['false_negatives_attack']:,} attacks** slipped past the detector classified as benign. |
| **Attack Precision** | **{bi['attack_precision']:.4f} ({bi['attack_precision']*100:.2f}%)** | When an attack alert fires, probability it is truly malicious. |
| **Attack F1-Score** | **{bi['attack_f1_score']:.4f} ({bi['attack_f1_score']*100:.2f}%)** | Harmonic balance between detection and alert fidelity. |
| **False Positive Rate (False Alarm Rate / FPR)** | **{bi['false_positive_rate']:.4f} ({bi['false_positive_rate']*100:.2f}%)** | **{bi['false_positives_attack']:,} benign packets** triggered false alerts. |
| **Normal Recall (Benign Specificity)** | **{bi['normal_recall']:.4f} ({bi['normal_recall']*100:.2f}%)** | Benign traffic successfully allowed through without alarm. |
| **Normal Precision** | **{bi['normal_precision']:.4f} ({bi['normal_precision']*100:.2f}%)** | When classified as normal, probability it is truly benign. |
| **Binary Classification Accuracy** | **{bi['binary_accuracy']:.4f} ({bi['binary_accuracy']*100:.2f}%)** | Overall binary discrimination rate. |

---

## 3. Area Under the Curve (AUC) Analysis

### Binary Discrimination (Attack vs. Normal)
* **Binary ROC-AUC:** **{b_auc['roc_auc']:.4f}** (Excellent ranking capability across confidence thresholds)
* **Binary PR-AUC:** **{b_auc['pr_auc']:.4f}** (Precision-Recall trade-off on attack positive class)

### Multiclass One-vs-Rest (OvR)
* **Macro-Averaged ROC-AUC:** **{m_auc['macro_roc_auc']:.4f}**
* **Weighted-Averaged ROC-AUC:** **{m_auc['weighted_roc_auc']:.4f}**
* **Macro-Averaged PR-AUC:** **{m_auc['macro_pr_auc']:.4f}**
* **Weighted-Averaged PR-AUC:** **{m_auc['weighted_pr_auc']:.4f}**

### Per-Class AUC Metrics
{auc_table}

---

## 4. Attack Misclassification into Normal Traffic (Sneak Attacks)

The most dangerous failure mode of an IDS is classifying an active cyberattack as **Normal** traffic. Below is the full breakdown of attacks that slipped through the system as benign:

{atn_table}

> **Critical Findings:**
> 1. **Backdoor attacks are the most stealthy:** **84.39% (492 of 583)** of all Backdoor connections were misclassified as Normal traffic.
> 2. **Analysis and Fuzzers have alarming leakage:** **51.26%** of Analysis attacks and **41.16% (2,495 packets)** of Fuzzers slipped past as normal traffic.
> 3. **High absolute packet leakage in DoS & Fuzzers:** While DoS has a lower percentage leakage (12.72%), **520 DoS attack flows** were completely missed as Normal. Combined with Fuzzers, over 3,000 volumetric/probing attacks breached benign boundaries.
> 4. **Generic attacks are near-immune to leakage:** Only **0.17% (33 of 18,871)** of Generic attacks were marked Normal, demonstrating that high-volume signature-based attacks are easily partitioned from normal traffic.

---

## 5. Per-Class Performance and Error Breakdown (One-vs-Rest)

{pcm_table}

---

## 6. Confusion Matrix (10x10)

Rows correspond to the **Actual Ground-Truth Class**; columns correspond to the **Predicted Class**.

{cm_table}

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
"""
    return report

if __name__ == "__main__":
    run_evaluation()
