"""SHAP explainability module for the Network Intrusion Detection ML Service.

Initializes TreeExplainer with the pre-trained XGBoost model and generates
global and local (record-level) SHAP explanations for the UNSW-NB15 dataset.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

import numpy as np
import pandas as pd
import shap

from app.predictor import RAW_FEATURE_NAMES, ModelNotLoadedError, predictor

logger = logging.getLogger(__name__)


class ExplanationError(Exception):
    """Raised when SHAP explanation generation fails."""
    pass


class Explainer:
    """Manages TreeExplainer initialization and explanation generation for multiclass and binary models."""

    def __init__(self) -> None:
        self.tree_explainer: Optional[shap.TreeExplainer] = None
        self.is_initialized: bool = False
        self.binary_tree_explainer: Optional[shap.TreeExplainer] = None
        self.is_binary_initialized: bool = False

    def initialize(self) -> bool:
        """Initialize SHAP TreeExplainer for both multiclass and binary models."""
        # 1. Multiclass TreeExplainer
        if predictor.is_loaded and predictor.model is not None:
            try:
                logger.info("Initializing SHAP TreeExplainer with 10-class XGBoost model...")
                self.tree_explainer = shap.TreeExplainer(predictor.model)
                self.is_initialized = True
                logger.info("10-class SHAP TreeExplainer successfully initialized.")
            except Exception as exc:
                logger.exception("Failed to initialize 10-class SHAP TreeExplainer: %s", exc)
                self.tree_explainer = None
                self.is_initialized = False

        # 2. Binary TreeExplainer
        if predictor.is_binary_loaded and predictor.binary_model is not None:
            try:
                logger.info("Initializing SHAP TreeExplainer with Binary XGBoost model...")
                self.binary_tree_explainer = shap.TreeExplainer(predictor.binary_model)
                self.is_binary_initialized = True
                logger.info("Binary SHAP TreeExplainer successfully initialized.")
            except Exception as exc:
                logger.exception("Failed to initialize Binary SHAP TreeExplainer: %s", exc)
                self.binary_tree_explainer = None
                self.is_binary_initialized = False

        return self.is_initialized or self.is_binary_initialized

    def get_global_explanations(self, top_k: int = 20) -> Dict[str, Any]:
        """Return the top-K global features based on saved global_importance.npy and feature_names.npy.

        Args:
            top_k: Number of top features to return (default: 20).

        Returns:
            Dict containing top_features list, importance_scores dict, and total_features count.

        Raises:
            ModelNotLoadedError: If artifacts or metadata are not loaded.
        """
        if (
            not predictor.is_loaded
            or predictor.feature_names is None
            or predictor.global_importance is None
        ):
            raise ModelNotLoadedError("Model artifacts or explanation metadata are not loaded.")

        gi = predictor.global_importance
        fn = predictor.feature_names

        # Get indices sorted descending by mean absolute SHAP value
        top_indices = np.argsort(gi)[-top_k:][::-1]

        top_features: List[Dict[str, Any]] = []
        importance_scores: Dict[str, float] = {}

        for rank, idx in enumerate(top_indices, start=1):
            feat_name = str(fn[idx])
            score = float(gi[idx])
            top_features.append({
                "feature": feat_name,
                "importance": score,
                "rank": rank,
            })
            importance_scores[feat_name] = score

        return {
            "top_features": top_features,
            "importance_scores": importance_scores,
            "total_features": len(fn),
        }

    def explain_local(
        self,
        features: Union[Dict[str, Any], Any],
        top_n: int = 10,
    ) -> Dict[str, Any]:
        """Generate SHAP explanation for a single raw 42-feature record.

        Args:
            features: Dictionary or Pydantic model containing the 42 raw features.
            top_n: Number of top positive and negative features to return (default: 10).

        Returns:
            Dict containing:
                - predicted_class: Predicted attack category name
                - base_value: Expected value for the predicted class logit
                - contributions: Dict mapping all 194 features to their SHAP values
                - feature_contributions: Alias for contributions
                - top_positive: List of top positive feature contributions
                - top_negative: List of top negative feature contributions
                - confidence: Model prediction confidence score
                - prediction: Alias for predicted_class
                - attack_category: Alias for predicted_class
                - class_index: Integer index of predicted class in label encoder

        Raises:
            ModelNotLoadedError: If the model or explainer is not ready.
            ExplanationError: If explanation computation fails.
        """
        if not predictor.is_loaded or predictor.model is None or predictor.preprocessor is None or predictor.label_encoder is None:
            raise ModelNotLoadedError("Model artifacts are not loaded or initialized.")

        # Ensure TreeExplainer is initialized
        if not self.is_initialized or self.tree_explainer is None:
            init_ok = self.initialize()
            if not init_ok or self.tree_explainer is None:
                raise ModelNotLoadedError("Failed to initialize SHAP TreeExplainer.")

        try:
            # 1. Extract raw dictionary from Pydantic model or dict
            if hasattr(features, "model_dump"):
                raw_dict = features.model_dump()
            elif isinstance(features, dict):
                raw_dict = features
            else:
                raise ValueError(f"Unsupported features type: {type(features)}")

            # 2. Build DataFrame with correct column order and apply preprocessor
            df = pd.DataFrame([raw_dict])[RAW_FEATURE_NAMES]
            transformed = predictor.preprocessor.transform(df)

            # Convert sparse matrix to dense array if necessary (matching notebook cell 41)
            if hasattr(transformed, "toarray"):
                X_dense = transformed.toarray()
            else:
                X_dense = np.asarray(transformed)

            # 3. Model prediction using predictor to guarantee 100% consistency with /predict
            pred_res = predictor.predict(raw_dict)
            predicted_class = pred_res["attack_category"]
            confidence = pred_res["confidence"]
            class_index = list(predictor.label_encoder.classes_).index(predicted_class)

            # 4. Compute SHAP values for the single record using dense array (matching notebook cell 41)
            shap_vals = self.tree_explainer.shap_values(X_dense)

            # Extract class-specific SHAP values for the predicted class
            if isinstance(shap_vals, list):
                class_shap = shap_vals[class_index][0]
            elif np.ndim(shap_vals) == 3:
                class_shap = shap_vals[0, :, class_index]
            else:
                class_shap = shap_vals[0]

            # 5. Extract base value for predicted class
            expected_val = self.tree_explainer.expected_value
            if isinstance(expected_val, (list, np.ndarray)) and len(expected_val) > class_index:
                base_value = float(expected_val[class_index])
            else:
                base_value = float(expected_val)

            # 6. Build full feature contributions dictionary
            fn = predictor.feature_names
            if fn is None:
                fn = np.array([f"feature_{i}" for i in range(len(class_shap))])

            contributions: Dict[str, float] = {
                str(fn[j]): float(class_shap[j]) for j in range(len(fn))
            }

            # 7. Extract top positive (pushing towards prediction)
            pos_candidates = [
                {
                    "feature": str(fn[j]),
                    "shap_value": float(class_shap[j]),
                    "feature_value": float(X_dense[0, j]),
                }
                for j in range(len(fn))
                if class_shap[j] > 0
            ]
            pos_candidates.sort(key=lambda x: x["shap_value"], reverse=True)
            top_positive = pos_candidates[:top_n]

            # 8. Extract top negative (pushing away from prediction)
            neg_candidates = [
                {
                    "feature": str(fn[j]),
                    "shap_value": float(class_shap[j]),
                    "feature_value": float(X_dense[0, j]),
                }
                for j in range(len(fn))
                if class_shap[j] < 0
            ]
            neg_candidates.sort(key=lambda x: x["shap_value"])  # most negative first
            top_negative = neg_candidates[:top_n]

            return {
                "predicted_class": predicted_class,
                "base_value": base_value,
                "contributions": contributions,
                "feature_contributions": contributions,
                "top_positive": top_positive,
                "top_negative": top_negative,
                "prediction": predicted_class,
                "attack_category": predicted_class,
                "confidence": confidence,
                "class_index": class_index,
            }

        except Exception as exc:
            logger.exception("Failed to generate local SHAP explanation: %s", exc)
            raise ExplanationError(f"Local SHAP explanation generation failed: {exc}") from exc

    def get_binary_global_explanations(self, top_k: int = 20) -> Dict[str, Any]:
        """Return the top-K global features for the binary XGBoost model.

        Uses precomputed mean absolute SHAP values across 10,000 stratified test network flows
        saved in binary_shap_summary.json.

        Args:
            top_k: Number of top features to return (default: 20).

        Returns:
            Dict containing top_features, importance_scores, total_features, base values, and units.
        """
        if not predictor.is_binary_loaded:
            raise ModelNotLoadedError("Binary model artifacts are not loaded.")

        summary = predictor.binary_shap_summary or {}
        raw_top = summary.get("top_20_global_features", [])

        if not raw_top and predictor.binary_feature_names is not None:
            # Fallback if summary was not loaded
            raw_top = [
                {
                    "rank": i + 1,
                    "raw_feature_name": str(predictor.binary_feature_names[i]),
                    "clean_name": str(predictor.binary_feature_names[i]).replace("cat__", "").replace("num__", ""),
                    "type": "Categorical" if str(predictor.binary_feature_names[i]).startswith("cat__") else "Numerical",
                    "mean_abs_shap": 0.0,
                    "primary_direction": "Unknown",
                }
                for i in range(min(top_k, len(predictor.binary_feature_names)))
            ]

        selected_top = raw_top[:top_k]
        importance_scores = {
            f["raw_feature_name"]: float(f["mean_abs_shap"])
            for f in selected_top
        }

        total_features = (
            len(predictor.binary_feature_names)
            if predictor.binary_feature_names is not None
            else 194
        )

        return {
            "top_features": selected_top,
            "importance_scores": importance_scores,
            "total_features": total_features,
            "base_value_log_odds": float(summary.get("base_value_log_odds", -0.02572)),
            "base_value_probability": float(summary.get("base_value_probability", 0.49357)),
            "chosen_decision_threshold": float(predictor.binary_threshold),
            "units": (
                "raw log-odds (margin contributions: margin = base_value + sum(SHAP), "
                "P = sigmoid(margin)); not probabilities"
            ),
        }

    def explain_binary_local(
        self,
        features: Union[Dict[str, Any], Any],
        top_n: int = 10,
    ) -> Dict[str, Any]:
        """Generate SHAP explanation for a single raw 42-feature record on the binary model.

        Calculates raw log-odds contributions, verifies exact additivity against the
        model's raw margin output, and extracts top positive and negative features.

        Args:
            features: Dictionary or Pydantic model containing the 42 raw features.
            top_n: Number of top positive and negative features to return (default: 10).

        Returns:
            Dict containing prediction, probability, log-odds margin, base_value,
            top_positive, top_negative, contributions, and additivity verification.
        """
        if not predictor.is_binary_loaded or predictor.binary_model is None or predictor.binary_preprocessor is None:
            raise ModelNotLoadedError("Binary model artifacts are not loaded or initialized.")

        # Ensure binary tree explainer is initialized
        if not self.is_binary_initialized or self.binary_tree_explainer is None:
            init_ok = self.initialize()
            if not self.is_binary_initialized or self.binary_tree_explainer is None:
                raise ModelNotLoadedError("Failed to initialize Binary SHAP TreeExplainer.")

        try:
            # 1. Extract raw dictionary
            if hasattr(features, "model_dump"):
                raw_dict = features.model_dump()
            elif isinstance(features, dict):
                raw_dict = features
            else:
                raise ValueError(f"Unsupported features type: {type(features)}")

            # 2. DataFrame with exact 42 raw features order
            df = pd.DataFrame([raw_dict])[RAW_FEATURE_NAMES]

            # 3. Transform using dedicated binary preprocessor
            transformed = predictor.binary_preprocessor.transform(df)
            if hasattr(transformed, "toarray"):
                X_dense = transformed.toarray()
            else:
                X_dense = np.asarray(transformed)

            # 4. Binary model inference for consistency with /predict/binary
            bin_pred = predictor.predict_binary(raw_dict)
            pred_label = bin_pred["prediction"]
            is_attack = bin_pred["is_attack"]
            prob = bin_pred["attack_probability"]
            threshold = bin_pred["threshold"]

            # 5. Compute raw margin output from XGBoost
            margin = float(predictor.binary_model.predict(X_dense, output_margin=True)[0])

            # 6. Compute SHAP values via TreeExplainer
            shap_vals = self.binary_tree_explainer.shap_values(X_dense)
            if isinstance(shap_vals, list):
                row_shap = shap_vals[0]
            elif np.ndim(shap_vals) == 2:
                row_shap = shap_vals[0]
            else:
                row_shap = np.asarray(shap_vals).ravel()

            # 7. Extract base value
            exp_val = self.binary_tree_explainer.expected_value
            if isinstance(exp_val, (list, np.ndarray)):
                base_value = float(exp_val[0])
            else:
                base_value = float(exp_val)

            # 8. Verify SHAP additivity: margin = base_value + sum(SHAP)
            sum_shap = float(np.sum(row_shap))
            additivity_diff = abs((base_value + sum_shap) - margin)
            additivity_verified = bool(additivity_diff < 1e-4)

            # 9. Feature names mapping
            fn = predictor.binary_feature_names
            if fn is None:
                fn = predictor.binary_preprocessor.get_feature_names_out()

            def _get_raw_val(f_name: str) -> Any:
                if f_name.startswith("num__"):
                    col = f_name[5:]
                    val = raw_dict.get(col, "N/A")
                elif f_name.startswith("cat__"):
                    sub = f_name[5:]
                    if sub.startswith("proto_"):
                        val = raw_dict.get("proto", "N/A")
                    elif sub.startswith("service_"):
                        val = raw_dict.get("service", "N/A")
                    elif sub.startswith("state_"):
                        val = raw_dict.get("state", "N/A")
                    else:
                        val = "N/A"
                else:
                    val = raw_dict.get(f_name, "N/A")

                if hasattr(val, "item"):
                    return val.item()
                if pd.isna(val):
                    return "N/A"
                if isinstance(val, (int, float, str, bool)):
                    return val
                return str(val)

            contributions: Dict[str, float] = {
                str(fn[j]): float(row_shap[j]) for j in range(len(fn))
            }

            # 10. Extract top positive (pushing towards Attack)
            pos_indices = np.argsort(row_shap)[::-1]
            top_positive = []
            for j in pos_indices:
                if row_shap[j] > 0 and len(top_positive) < top_n:
                    f_str = str(fn[j])
                    top_positive.append({
                        "feature": f_str,
                        "shap_value": float(row_shap[j]),
                        "feature_value": float(X_dense[0, j]),
                        "raw_input_value": _get_raw_val(f_str),
                    })

            # 11. Extract top negative (pushing towards Normal)
            neg_indices = np.argsort(row_shap)
            top_negative = []
            for j in neg_indices:
                if row_shap[j] < 0 and len(top_negative) < top_n:
                    f_str = str(fn[j])
                    top_negative.append({
                        "feature": f_str,
                        "shap_value": float(row_shap[j]),
                        "feature_value": float(X_dense[0, j]),
                        "raw_input_value": _get_raw_val(f_str),
                    })

            return {
                "prediction": pred_label,
                "is_attack": is_attack,
                "attack_probability": prob,
                "raw_log_odds_margin": margin,
                "base_value": base_value,
                "sum_of_shap_values": sum_shap,
                "additivity_error": additivity_diff,
                "additivity_verified": additivity_verified,
                "threshold": threshold,
                "units": (
                    "raw log-odds margin contributions (additive in logit space: "
                    "margin = base_value + sum(SHAP), P = sigmoid(margin)); not probabilities"
                ),
                "top_positive": top_positive,
                "top_negative": top_negative,
                "contributions": contributions,
            }

        except Exception as exc:
            logger.exception("Failed to generate binary local SHAP explanation: %s", exc)
            raise ExplanationError(f"Binary local SHAP explanation failed: {exc}") from exc


# Global singleton instance for centralized access
explainer: Explainer = Explainer()
