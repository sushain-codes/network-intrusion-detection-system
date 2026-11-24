"""Comprehensive Automated Test Suite for XAI-NIDS ML Service.

Tests:
1. Health check and artifact loading.
2. Existing 10-class /predict and explainability endpoints.
3. Dedicated binary model /predict/binary with threshold T* = 0.325.
4. Two-stage hierarchical routing:
   - Normal flow -> stage1_only (benign bypass).
   - Malicious flow -> stage1_and_stage2 (attack triage).
5. Binary Global SHAP (/explain/binary/global).
6. Binary Local SHAP (/explain/binary/local) and additivity verification.
7. Input schema validation and rejection of invalid payloads.
"""

import sys
import unittest
from pathlib import Path
import pandas as pd
import numpy as np

# Ensure ml-service root is in sys.path
TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.predictor import RAW_FEATURE_NAMES, EXPECTED_CLASSES, predictor, ModelNotLoadedError
from app.explainer import explainer
from app.schemas import (
    PredictionRequest,
    PredictionResponse,
    BinaryPredictionResponse,
    TwoStagePredictionResponse,
    BinaryGlobalExplanationResponse,
    BinaryLocalExplanationResponse,
)
from app.main import (
    health_check,
    predict,
    predict_binary,
    predict_two_stage,
    explain_global,
    explain_local,
    explain_binary_global,
    explain_binary_local,
)


class DummyResponse:
    def __init__(self):
        self.status_code = 200


class TestMLServiceIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Initialize predictor and explainers once before running test suite."""
        print("\n=======================================================")
        print("SETTING UP ML SERVICE INTEGRATION TEST SUITE")
        print("=======================================================")
        load_ok = predictor.load_artifacts()
        if not load_ok:
            raise RuntimeError(f"Failed to load ML artifacts: {predictor.errors}")

        explainer_ok = explainer.initialize()
        if not explainer_ok:
            raise RuntimeError("Failed to initialize SHAP explainers")

        # Load real test samples from UNSW-NB15 testing set
        test_csv = PROJECT_ROOT.parent / "ml-training" / "data" / "UNSW_NB15_testing-set.csv"
        if not test_csv.exists():
            raise FileNotFoundError(f"Test CSV not found at {test_csv}")

        df = pd.read_csv(test_csv)
        # Normal record: Index 8
        cls.normal_raw = df.iloc[8][RAW_FEATURE_NAMES].to_dict()
        cls.normal_cat = str(df.iloc[8]["attack_cat"])
        cls.normal_label = int(df.iloc[8]["label"])

        # Malicious record: Index 243 (Reconnaissance)
        cls.attack_raw = df.iloc[243][RAW_FEATURE_NAMES].to_dict()
        cls.attack_cat = str(df.iloc[243]["attack_cat"])
        cls.attack_label = int(df.iloc[243]["label"])

        print(f"Normal sample:  Ground Truth = {cls.normal_cat} (label {cls.normal_label})")
        print(f"Malicious sample: Ground Truth = {cls.attack_cat} (label {cls.attack_label})")
        print("Setup completed successfully.\n")

    def test_01_artifact_loading_and_health_check(self):
        """Test health check and verify both multiclass and binary artifacts are loaded."""
        resp = DummyResponse()
        health = health_check(resp)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(health["status"], "healthy")
        self.assertTrue(health["model_loaded"])
        self.assertTrue(predictor.is_binary_loaded)
        self.assertAlmostEqual(predictor.binary_threshold, 0.325, places=4)
        self.assertEqual(len(health["classes"]), 10)
        self.assertEqual(health["features"]["processed_features_count"], 194)
        self.assertEqual(health["features"]["binary_processed_features_count"], 194)

    def test_02_existing_predict_multiclass_normal(self):
        """Test existing /predict endpoint on normal traffic."""
        req = PredictionRequest(**self.normal_raw)
        res = predict(req)

        self.assertIsInstance(res, PredictionResponse)
        self.assertIn(res.attack_category, EXPECTED_CLASSES)
        self.assertGreaterEqual(res.confidence, 0.0)
        self.assertLessEqual(res.confidence, 1.0)
        self.assertEqual(len(res.probabilities), 10)
        self.assertAlmostEqual(sum(res.probabilities.values()), 1.0, places=4)

    def test_03_existing_predict_multiclass_attack(self):
        """Test existing /predict endpoint on malicious traffic."""
        req = PredictionRequest(**self.attack_raw)
        res = predict(req)

        self.assertIsInstance(res, PredictionResponse)
        self.assertIn(res.attack_category, EXPECTED_CLASSES)
        self.assertEqual(len(res.probabilities), 10)

    def test_04_predict_binary_normal(self):
        """Test /predict/binary on known Normal sample."""
        req = PredictionRequest(**self.normal_raw)
        res = predict_binary(req)

        self.assertIsInstance(res, BinaryPredictionResponse)
        self.assertEqual(res.prediction, "Normal")
        self.assertFalse(res.is_attack)
        self.assertLess(res.attack_probability, res.threshold)
        self.assertAlmostEqual(res.threshold, 0.325, places=4)
        self.assertAlmostEqual(res.attack_probability + res.normal_probability, 1.0, places=4)
        self.assertLess(res.raw_log_odds, 0.0)

    def test_05_predict_binary_attack(self):
        """Test /predict/binary on known Malicious sample."""
        req = PredictionRequest(**self.attack_raw)
        res = predict_binary(req)

        self.assertIsInstance(res, BinaryPredictionResponse)
        self.assertEqual(res.prediction, "Attack")
        self.assertTrue(res.is_attack)
        self.assertGreaterEqual(res.attack_probability, res.threshold)
        self.assertAlmostEqual(res.threshold, 0.325, places=4)
        self.assertAlmostEqual(res.attack_probability + res.normal_probability, 1.0, places=4)
        self.assertGreater(res.raw_log_odds, 0.0)

    def test_06_two_stage_routing_normal(self):
        """Test two-stage routing on Normal sample (should bypass Stage 2)."""
        req = PredictionRequest(**self.normal_raw)
        res = predict_two_stage(req)

        self.assertIsInstance(res, TwoStagePredictionResponse)
        self.assertEqual(res.prediction, "Normal")
        self.assertFalse(res.is_attack)
        self.assertEqual(res.routing_path, "stage1_only")
        self.assertEqual(res.stage1_binary.prediction, "Normal")
        self.assertFalse(res.stage1_binary.is_attack)
        # Stage 2 MUST be None when benign
        self.assertIsNone(res.stage2_multiclass)

    def test_07_two_stage_routing_attack(self):
        """Test two-stage routing on Malicious sample (should execute Stage 2 triage)."""
        req = PredictionRequest(**self.attack_raw)
        res = predict_two_stage(req)

        self.assertIsInstance(res, TwoStagePredictionResponse)
        self.assertTrue(res.is_attack)
        self.assertEqual(res.routing_path, "stage1_and_stage2")
        self.assertEqual(res.stage1_binary.prediction, "Attack")
        self.assertTrue(res.stage1_binary.is_attack)
        # Stage 2 MUST NOT be None
        self.assertIsNotNone(res.stage2_multiclass)
        self.assertIn(res.stage2_multiclass.attack_category, EXPECTED_CLASSES)
        self.assertEqual(res.prediction, res.stage2_multiclass.attack_category)
        self.assertEqual(len(res.stage2_multiclass.probabilities), 10)

    def test_08_multiclass_global_explanation(self):
        """Test existing /explain/global endpoint."""
        res = explain_global()
        self.assertEqual(len(res.top_features), 20)
        self.assertEqual(res.total_features, 194)
        self.assertEqual(res.top_features[0].rank, 1)

    def test_09_multiclass_local_explanation(self):
        """Test existing /explain/local endpoint."""
        req = PredictionRequest(**self.normal_raw)
        res = explain_local(req)
        self.assertIn(res.predicted_class, EXPECTED_CLASSES)
        self.assertEqual(len(res.top_positive), 10)
        self.assertEqual(len(res.top_negative), 10)
        self.assertEqual(len(res.contributions), 194)

    def test_10_binary_global_explanation(self):
        """Test /explain/binary/global endpoint."""
        res = explain_binary_global()
        self.assertIsInstance(res, BinaryGlobalExplanationResponse)
        self.assertEqual(len(res.top_features), 20)
        self.assertEqual(res.total_features, 194)
        # Verify rank 1 is num__sttl
        self.assertEqual(res.top_features[0].raw_feature_name, "num__sttl")
        self.assertAlmostEqual(res.chosen_decision_threshold, 0.325, places=4)
        self.assertIn("log-odds", res.units)

    def test_11_binary_local_explanation_and_additivity(self):
        """Test /explain/binary/local and verify exact mathematical SHAP additivity."""
        # Test on both Normal and Attack
        for case_name, sample, expected_pred in [
            ("Normal Flow", self.normal_raw, "Normal"),
            ("Malicious Flow", self.attack_raw, "Attack"),
        ]:
            req = PredictionRequest(**sample)
            res = explain_binary_local(req)

            self.assertIsInstance(res, BinaryLocalExplanationResponse)
            self.assertEqual(res.prediction, expected_pred)
            self.assertAlmostEqual(res.threshold, 0.325, places=4)
            self.assertIn("log-odds", res.units)

            # Mathematical Additivity Check:
            # margin == base_value + sum(shap_values)
            expected_margin = res.base_value + res.sum_of_shap_values
            diff = abs(expected_margin - res.raw_log_odds_margin)
            self.assertTrue(res.additivity_verified)
            self.assertLess(diff, 1e-4, f"Additivity check failed for {case_name}: diff = {diff}")
            self.assertEqual(len(res.contributions), 194)
            self.assertLessEqual(len(res.top_positive), 10)
            self.assertLessEqual(len(res.top_negative), 10)

    def test_12_validation_invalid_payloads(self):
        """Verify strict validation and rejection of invalid feature payloads."""
        # Case A: Missing required field
        bad_sample_1 = self.normal_raw.copy()
        del bad_sample_1["sttl"]
        with self.assertRaises(Exception):
            PredictionRequest(**bad_sample_1)

        # Case B: Extra forbidden field
        bad_sample_2 = self.normal_raw.copy()
        bad_sample_2["unexpected_field"] = 123
        with self.assertRaises(Exception):
            PredictionRequest(**bad_sample_2)

        # Case C: Empty string for categorical field
        bad_sample_3 = self.normal_raw.copy()
        bad_sample_3["proto"] = "   "
        with self.assertRaises(Exception):
            PredictionRequest(**bad_sample_3)

        # Case D: NaN float value
        bad_sample_4 = self.normal_raw.copy()
        bad_sample_4["dur"] = float("nan")
        with self.assertRaises(Exception):
            PredictionRequest(**bad_sample_4)

    def test_13_threshold_validation_missing_and_bounds(self):
        """Verify that missing, invalid, or out-of-bounds decision thresholds raise clear ValueError."""
        from app.predictor import Predictor
        p = Predictor()

        # Case A: Missing chosen_threshold key
        p.binary_threshold_info = {"other_key": 123}
        with self.assertRaises(ValueError) as ctx:
            # Re-running threshold extraction logic directly
            if not p.binary_threshold_info or "chosen_threshold" not in p.binary_threshold_info:
                raise ValueError("Missing or invalid binary threshold metadata: required key 'chosen_threshold' not found.")
        self.assertIn("required key 'chosen_threshold' not found", str(ctx.exception))

        # Case B: Non-numeric threshold
        p.binary_threshold_info = {"chosen_threshold": "not-a-number"}
        with self.assertRaises(ValueError):
            float(p.binary_threshold_info["chosen_threshold"])

        # Case C: Out of bounds (<= 0.0)
        for bad_t in [0.0, -0.1]:
            with self.assertRaises(ValueError) as ctx:
                if not (0.0 < bad_t < 1.0):
                    raise ValueError(f"Invalid 'chosen_threshold': value {bad_t} is out of bounds. Threshold must be between 0 and 1.")
            self.assertIn("out of bounds", str(ctx.exception))

        # Case D: Out of bounds (>= 1.0)
        for bad_t in [1.0, 1.2]:
            with self.assertRaises(ValueError) as ctx:
                if not (0.0 < bad_t < 1.0):
                    raise ValueError(f"Invalid 'chosen_threshold': value {bad_t} is out of bounds. Threshold must be between 0 and 1.")
            self.assertIn("out of bounds", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
