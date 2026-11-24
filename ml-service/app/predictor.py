"""Predictor module for the Network Intrusion Detection ML Service.

Centralizes loading, validation, and access to the machine learning model,
preprocessing pipeline, label encoder, and explanation metadata.
All paths are resolved relative to the ml-service project directory.
"""

from __future__ import annotations

import logging
import math
import os
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import joblib
import numpy as np
import pandas as pd

# Configure module-level logger
logger = logging.getLogger(__name__)


class ModelNotLoadedError(RuntimeError):
    """Raised when prediction is requested before artifacts are loaded."""
    pass


class PredictionError(Exception):
    """Raised when preprocessing or model inference fails."""
    pass

# -----------------------------------------------------------------------------
# Cross-Version and Cross-Platform Serialization Compatibility Shims
# -----------------------------------------------------------------------------

# 1. Compatibility for scikit-learn:
# preprocessor.joblib was saved in scikit-learn 1.6.1 where ColumnTransformer
# used _RemainderColsList. Newer scikit-learn releases refactored this internal helper.
try:
    import sklearn.compose._column_transformer
    if not hasattr(sklearn.compose._column_transformer, "_RemainderColsList"):
        class _RemainderColsList(list):
            """Compatibility alias for scikit-learn ColumnTransformer unpickling."""
            pass

        sklearn.compose._column_transformer._RemainderColsList = _RemainderColsList
except ImportError:
    pass

# 2. Compatibility for XGBoost cross-platform unpickling:
# XGBoost models trained on Linux/Google Colab (libstdc++) serialize std::mt19937
# rng_state as decimal integers, whereas Windows (MSVC STL) parses rng_state as hex.
# This causes 'input stream corrupted' on Windows if loaded directly via joblib/pickle.
try:
    import xgboost.core as xgb_core
    _orig_booster_setstate = xgb_core.Booster.__setstate__

    def _patched_booster_setstate(self: Any, state: Dict[str, Any]) -> None:
        try:
            _orig_booster_setstate(self, state)
        except Exception as exc:
            # Handle Linux->Windows rng_state incompatibility in memory without altering artifacts
            if "input stream corrupted" in str(exc) and "handle" in state:
                buf = bytearray(state["handle"])
                pos = buf.find(b"rng_state")
                if pos != -1 and buf[pos + 9 : pos + 11] == b"SL":
                    s_pos = pos + 9
                    str_len = int.from_bytes(buf[s_pos + 2 : s_pos + 10], "big")
                    rng_str = buf[s_pos + 10 : s_pos + 10 + str_len].decode("latin1")
                    tokens = rng_str.strip().split()
                    try:
                        hex_tokens = [f"{int(t):x}" for t in tokens]
                        new_rng_str = " ".join(hex_tokens) + " "
                        new_bytes = new_rng_str.encode("latin1")
                        new_buf = (
                            buf[: s_pos + 2]
                            + len(new_bytes).to_bytes(8, "big")
                            + new_bytes
                            + buf[s_pos + 10 + str_len :]
                        )
                        state["handle"] = new_buf
                        _orig_booster_setstate(self, state)
                        return
                    except Exception:
                        pass
            raise

    xgb_core.Booster.__setstate__ = _patched_booster_setstate
except (ImportError, AttributeError):
    pass


# -----------------------------------------------------------------------------
# Base Directories and Artifact Filenames
# -----------------------------------------------------------------------------

# Resolve the ml-service project root directory (one level above app/)
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent

# Default directory where pre-trained artifacts are stored
DEFAULT_ARTIFACTS_DIR: Path = PROJECT_ROOT / "artifacts"

# Artifact filenames required by the ML service
ARTIFACT_FILENAMES: Dict[str, str] = {
    "model": "xgb_model.joblib",
    "preprocessor": "preprocessor.joblib",
    "label_encoder": "label_encoder.joblib",
    "feature_names": "feature_names.npy",
    "global_importance": "global_importance.npy",
    "individual_shap": "individual_shap.npy",
    "selected_record": "selected_record.npy",
    # Binary model artifacts
    "binary_model": "binary_xgb_model.joblib",
    "binary_preprocessor": "binary_preprocessor.joblib",
    "binary_threshold": "binary_threshold.json",
    "binary_shap_summary": "binary_shap_summary.json",
}

# -----------------------------------------------------------------------------
# Raw Feature Schema (UNSW-NB15 Dataset)
# Extracted directly from Network_Intrusion_Detection.ipynb
# -----------------------------------------------------------------------------

# Categorical input features (3 columns)
CATEGORICAL_FEATURES: List[str] = [
    "proto",
    "service",
    "state",
]

# Numerical input features (39 columns)
NUMERICAL_FEATURES: List[str] = [
    "dur",
    "spkts",
    "dpkts",
    "sbytes",
    "dbytes",
    "rate",
    "sttl",
    "dttl",
    "sload",
    "dload",
    "sloss",
    "dloss",
    "sinpkt",
    "dinpkt",
    "sjit",
    "djit",
    "swin",
    "stcpb",
    "dtcpb",
    "dwin",
    "tcprtt",
    "synack",
    "ackdat",
    "smean",
    "dmean",
    "trans_depth",
    "response_body_len",
    "ct_srv_src",
    "ct_state_ttl",
    "ct_dst_ltm",
    "ct_src_dport_ltm",
    "ct_dst_sport_ltm",
    "ct_dst_src_ltm",
    "is_ftp_login",
    "ct_ftp_cmd",
    "ct_flw_http_mthd",
    "ct_src_ltm",
    "ct_srv_dst",
    "is_sm_ips_ports",
]

# Complete raw input feature list (42 features, exact order after dropping id, attack_cat, label)
RAW_FEATURE_NAMES: List[str] = [
    "dur",
    "proto",
    "service",
    "state",
    "spkts",
    "dpkts",
    "sbytes",
    "dbytes",
    "rate",
    "sttl",
    "dttl",
    "sload",
    "dload",
    "sloss",
    "dloss",
    "sinpkt",
    "dinpkt",
    "sjit",
    "djit",
    "swin",
    "stcpb",
    "dtcpb",
    "dwin",
    "tcprtt",
    "synack",
    "ackdat",
    "smean",
    "dmean",
    "trans_depth",
    "response_body_len",
    "ct_srv_src",
    "ct_state_ttl",
    "ct_dst_ltm",
    "ct_src_dport_ltm",
    "ct_dst_sport_ltm",
    "ct_dst_src_ltm",
    "is_ftp_login",
    "ct_ftp_cmd",
    "ct_flw_http_mthd",
    "ct_src_ltm",
    "ct_srv_dst",
    "is_sm_ips_ports",
]

# Expected target attack categories (10 classes from label_encoder)
EXPECTED_CLASSES: List[str] = [
    "Analysis",
    "Backdoor",
    "DoS",
    "Exploits",
    "Fuzzers",
    "Generic",
    "Normal",
    "Reconnaissance",
    "Shellcode",
    "Worms",
]


class Predictor:
    """Manages loading, validating, and accessing model and preprocessing artifacts."""

    def __init__(self, artifacts_dir: Optional[Path] = None) -> None:
        """Initialize the Predictor instance.

        Args:
            artifacts_dir: Optional custom path to directory containing artifacts.
                           Defaults to ml-service/artifacts/.
        """
        self.artifacts_dir: Path = artifacts_dir or Path(
            os.getenv("ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS_DIR))
        )

        # Multiclass Artifact holders
        self.model: Any = None
        self.preprocessor: Any = None
        self.label_encoder: Any = None
        self.feature_names: Optional[np.ndarray] = None
        self.global_importance: Optional[np.ndarray] = None
        self.individual_shap: Optional[np.ndarray] = None
        self.selected_record: Optional[np.ndarray] = None

        # Binary Artifact holders
        self.binary_model: Any = None
        self.binary_preprocessor: Any = None
        self.binary_threshold: Optional[float] = None
        self.binary_threshold_info: Dict[str, Any] = {}
        self.binary_feature_names: Optional[np.ndarray] = None
        self.binary_shap_summary: Optional[Dict[str, Any]] = None

        # Metadata
        self.classes: List[str] = []
        self.is_loaded: bool = False
        self.is_binary_loaded: bool = False
        self.errors: List[str] = []
        self.artifact_status: Dict[str, Dict[str, Any]] = {}

    def load_artifacts(self, artifacts_dir: Optional[Path] = None) -> bool:
        """Load and validate all artifacts from the specified or default directory.

        Args:
            artifacts_dir: Optional override for artifacts directory.

        Returns:
            bool: True if all artifacts loaded and validated successfully, False otherwise.
        """
        if artifacts_dir:
            self.artifacts_dir = Path(artifacts_dir)

        self.errors = []
        self.artifact_status = {}
        self.is_loaded = False
        self.is_binary_loaded = False

        logger.info("Loading ML artifacts from: %s", self.artifacts_dir)

        if not self.artifacts_dir.exists() or not self.artifacts_dir.is_dir():
            err_msg = f"Artifacts directory not found: {self.artifacts_dir}"
            logger.error(err_msg)
            self.errors.append(err_msg)
            return False

        # 1. Load multiclass joblib artifacts
        self._load_joblib_artifact("model", ARTIFACT_FILENAMES["model"])
        self._load_joblib_artifact("preprocessor", ARTIFACT_FILENAMES["preprocessor"])
        self._load_joblib_artifact("label_encoder", ARTIFACT_FILENAMES["label_encoder"])

        # 2. Load multiclass numpy metadata artifacts
        self._load_numpy_artifact("feature_names", ARTIFACT_FILENAMES["feature_names"])
        self._load_numpy_artifact("global_importance", ARTIFACT_FILENAMES["global_importance"])
        self._load_numpy_artifact("individual_shap", ARTIFACT_FILENAMES["individual_shap"])
        self._load_numpy_artifact("selected_record", ARTIFACT_FILENAMES["selected_record"])

        # 3. Load binary model artifacts
        self._load_joblib_artifact("binary_model", ARTIFACT_FILENAMES["binary_model"])
        self._load_joblib_artifact("binary_preprocessor", ARTIFACT_FILENAMES["binary_preprocessor"])
        self._load_json_artifact("binary_threshold_info", ARTIFACT_FILENAMES["binary_threshold"])
        self._load_json_artifact("binary_shap_summary", ARTIFACT_FILENAMES["binary_shap_summary"])

        # Extract and strictly validate decision threshold from binary_threshold.json
        if not self.binary_threshold_info or "chosen_threshold" not in self.binary_threshold_info:
            err_msg = (
                f"Missing or invalid binary threshold metadata in {ARTIFACT_FILENAMES['binary_threshold']}: "
                "required key 'chosen_threshold' not found."
            )
            logger.error(err_msg)
            self.errors.append(err_msg)
            raise ValueError(err_msg)

        raw_thresh = self.binary_threshold_info["chosen_threshold"]
        try:
            loaded_t = float(raw_thresh)
        except (TypeError, ValueError) as exc:
            err_msg = (
                f"Invalid 'chosen_threshold' in {ARTIFACT_FILENAMES['binary_threshold']}: "
                f"received {raw_thresh!r} ({exc}). Threshold must be a valid float."
            )
            logger.error(err_msg)
            self.errors.append(err_msg)
            raise ValueError(err_msg) from exc

        if math.isnan(loaded_t) or math.isinf(loaded_t):
            err_msg = (
                f"Invalid 'chosen_threshold' in {ARTIFACT_FILENAMES['binary_threshold']}: "
                f"value {raw_thresh!r} is not finite."
            )
            logger.error(err_msg)
            self.errors.append(err_msg)
            raise ValueError(err_msg)

        if not (0.0 < loaded_t < 1.0):
            err_msg = (
                f"Invalid 'chosen_threshold' in {ARTIFACT_FILENAMES['binary_threshold']}: "
                f"value {loaded_t} is out of bounds. Threshold must be between 0 and 1 (0 < threshold < 1)."
            )
            logger.error(err_msg)
            self.errors.append(err_msg)
            raise ValueError(err_msg)

        self.binary_threshold = loaded_t
        logger.info(
            "Successfully loaded and validated binary decision threshold T* = %.4f from %s",
            self.binary_threshold,
            ARTIFACT_FILENAMES["binary_threshold"],
        )

        # Extract feature names from binary preprocessor
        if self.binary_preprocessor is not None and hasattr(self.binary_preprocessor, "get_feature_names_out"):
            try:
                self.binary_feature_names = self.binary_preprocessor.get_feature_names_out()
            except Exception as exc:
                logger.warning("Failed to get feature names from binary preprocessor: %s", exc)

        # 4. Post-load consistency checks
        self._validate_artifacts()

        if not self.errors:
            self.is_loaded = True
            logger.info("All artifacts successfully loaded and validated.")
        else:
            self.is_loaded = False
            logger.warning("Artifact loading finished with errors: %s", self.errors)

        return self.is_loaded

    def _load_joblib_artifact(self, key: str, filename: str) -> None:
        """Helper to safely load a joblib artifact."""
        file_path = self.artifacts_dir / filename
        status_entry: Dict[str, Any] = {
            "filename": filename,
            "path": str(file_path),
            "exists": file_path.exists(),
            "loaded": False,
            "error": None,
        }

        if not file_path.exists():
            msg = f"Missing required artifact file: {filename}"
            status_entry["error"] = msg
            self.errors.append(msg)
            self.artifact_status[key] = status_entry
            return

        try:
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=UserWarning)
                obj = joblib.load(file_path)
            setattr(self, key, obj)
            status_entry["loaded"] = True
            status_entry["type"] = type(obj).__name__
            logger.debug("Successfully loaded %s from %s", key, filename)
        except Exception as exc:
            msg = f"Failed to load {filename}: {exc}"
            logger.exception(msg)
            status_entry["error"] = msg
            self.errors.append(msg)

        self.artifact_status[key] = status_entry

    def _load_numpy_artifact(self, key: str, filename: str) -> None:
        """Helper to safely load a numpy array artifact."""
        file_path = self.artifacts_dir / filename
        status_entry: Dict[str, Any] = {
            "filename": filename,
            "path": str(file_path),
            "exists": file_path.exists(),
            "loaded": False,
            "error": None,
        }

        if not file_path.exists():
            msg = f"Missing required artifact file: {filename}"
            status_entry["error"] = msg
            self.errors.append(msg)
            self.artifact_status[key] = status_entry
            return

        try:
            arr = np.load(file_path, allow_pickle=True)
            setattr(self, key, arr)
            status_entry["loaded"] = True
            status_entry["shape"] = list(arr.shape)
            status_entry["dtype"] = str(arr.dtype)
            logger.debug("Successfully loaded %s from %s (shape: %s)", key, filename, arr.shape)
        except Exception as exc:
            msg = f"Failed to load {filename}: {exc}"
            logger.exception(msg)
            status_entry["error"] = msg
            self.errors.append(msg)

        self.artifact_status[key] = status_entry

    def _load_json_artifact(self, key: str, filename: str) -> None:
        """Helper to safely load a JSON artifact."""
        import json
        file_path = self.artifacts_dir / filename
        status_entry: Dict[str, Any] = {
            "filename": filename,
            "path": str(file_path),
            "exists": file_path.exists(),
            "loaded": False,
            "error": None,
        }

        if not file_path.exists():
            msg = f"Missing artifact file: {filename}"
            status_entry["error"] = msg
            self.artifact_status[key] = status_entry
            return

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            setattr(self, key, data)
            status_entry["loaded"] = True
            logger.debug("Successfully loaded %s from %s", key, filename)
        except Exception as exc:
            msg = f"Failed to load {filename}: {exc}"
            logger.exception(msg)
            status_entry["error"] = msg

        self.artifact_status[key] = status_entry

    def _validate_artifacts(self) -> None:
        """Validate consistency of the loaded artifacts."""
        # Validate label encoder and extract classes
        if self.label_encoder is not None:
            try:
                classes = list(self.label_encoder.classes_)
                self.classes = [str(c) for c in classes]
                if self.artifact_status.get("label_encoder"):
                    self.artifact_status["label_encoder"]["classes"] = self.classes
                    self.artifact_status["label_encoder"]["num_classes"] = len(self.classes)
            except AttributeError as exc:
                msg = f"label_encoder does not have classes_ attribute: {exc}"
                self.errors.append(msg)

        # Validate feature_names
        if self.feature_names is not None:
            expected_feature_count = 194
            actual_count = len(self.feature_names)
            if actual_count != expected_feature_count:
                msg = (
                    f"feature_names length mismatch: expected {expected_feature_count}, "
                    f"got {actual_count}"
                )
                self.errors.append(msg)

        # Validate global_importance shape
        if self.global_importance is not None and self.feature_names is not None:
            if len(self.global_importance) != len(self.feature_names):
                msg = (
                    f"global_importance length ({len(self.global_importance)}) does not match "
                    f"feature_names length ({len(self.feature_names)})"
                )
                self.errors.append(msg)

        # Validate binary model and binary preprocessor
        if self.binary_model is not None and self.binary_preprocessor is not None:
            self.is_binary_loaded = True
            logger.info("Binary intrusion detection model and preprocessor ready.")
        else:
            self.is_binary_loaded = False
            logger.warning("Binary model or preprocessor not loaded.")

    def predict(
        self,
        features: Union[Dict[str, Any], Any],
    ) -> Dict[str, Any]:
        """Run preprocessing and XGBoost prediction for a single network record.

        Args:
            features: Dictionary or Pydantic model containing the 42 raw features.

        Returns:
            Dict containing:
                - attack_category: Predicted attack class name
                - confidence: Confidence score of the prediction (max class probability)
                - probabilities: Dictionary mapping class name to predicted probability
                - prediction: Alias for attack_category

        Raises:
            ModelNotLoadedError: If the model or required artifacts are not loaded.
            PredictionError: If preprocessing or prediction fails.
        """
        if (
            not self.is_loaded
            or self.model is None
            or self.preprocessor is None
            or self.label_encoder is None
        ):
            raise ModelNotLoadedError("Model artifacts are not loaded or initialized.")

        try:
            # If features is a Pydantic model, convert to dict
            if hasattr(features, "model_dump"):
                raw_dict = features.model_dump()
            elif isinstance(features, dict):
                raw_dict = features
            else:
                raise ValueError(f"Unsupported features type: {type(features)}")

            # 1. Convert input into DataFrame with the exact raw feature column order
            df = pd.DataFrame([raw_dict])[RAW_FEATURE_NAMES]

            # 2. Apply the saved preprocessor
            transformed = self.preprocessor.transform(df)

            # 3. Run XGBoost prediction
            predicted_encoded = self.model.predict(transformed)
            probabilities = self.model.predict_proba(transformed)[0]

            # 4. Decode the predicted class using the saved label encoder
            pred_code = int(predicted_encoded[0])
            predicted_class = str(self.label_encoder.inverse_transform([pred_code])[0])

            # 5. Calculate confidence score and probability dictionary for all 10 classes
            confidence = float(np.max(probabilities))
            classes = [str(c) for c in self.label_encoder.classes_]
            prob_dict = {
                cls_name: float(prob)
                for cls_name, prob in zip(classes, probabilities)
            }

            return {
                "attack_category": predicted_class,
                "confidence": confidence,
                "probabilities": prob_dict,
                "prediction": predicted_class,
            }
        except Exception as exc:
            logger.exception("Prediction failed: %s", exc)
            raise PredictionError(f"Prediction execution failed: {exc}") from exc

    def predict_binary(
        self,
        features: Union[Dict[str, Any], Any],
    ) -> Dict[str, Any]:
        """Run preprocessing and Binary XGBoost prediction for a single network record.

        Accepts the exact 42 raw features, transforms using binary_preprocessor,
        and applies the tuned decision threshold T* = 0.325.

        Args:
            features: Dictionary or Pydantic model containing the 42 raw features.

        Returns:
            Dict containing:
                - prediction: 'Normal' or 'Attack'
                - attack_category: 'Normal' or 'Attack'
                - is_attack: bool
                - attack_probability: float
                - normal_probability: float
                - threshold: float (e.g. 0.325)
                - raw_log_odds: float

        Raises:
            ModelNotLoadedError: If binary model or preprocessor is not loaded.
            PredictionError: If inference fails.
        """
        if (
            not self.is_binary_loaded
            or self.binary_model is None
            or self.binary_preprocessor is None
            or self.binary_threshold is None
        ):
            raise ModelNotLoadedError("Binary model artifacts or decision threshold are not loaded or initialized.")

        try:
            if hasattr(features, "model_dump"):
                raw_dict = features.model_dump()
            elif isinstance(features, dict):
                raw_dict = features
            else:
                raise ValueError(f"Unsupported features type: {type(features)}")

            # DataFrame with exact 42 raw features order
            df = pd.DataFrame([raw_dict])[RAW_FEATURE_NAMES]

            # Transform with binary preprocessor
            transformed = self.binary_preprocessor.transform(df)

            # Raw log-odds margin and predicted probability
            raw_margin = float(self.binary_model.predict(transformed, output_margin=True)[0])
            prob_attack = float(self.binary_model.predict_proba(transformed)[0, 1])
            is_attack = bool(prob_attack >= self.binary_threshold)
            pred_label = "Attack" if is_attack else "Normal"

            return {
                "prediction": pred_label,
                "attack_category": pred_label,
                "is_attack": is_attack,
                "attack_probability": prob_attack,
                "normal_probability": float(1.0 - prob_attack),
                "threshold": self.binary_threshold,
                "raw_log_odds": raw_margin,
            }
        except Exception as exc:
            logger.exception("Binary prediction failed: %s", exc)
            raise PredictionError(f"Binary prediction failed: {exc}") from exc

    def predict_two_stage(
        self,
        features: Union[Dict[str, Any], Any],
    ) -> Dict[str, Any]:
        """Run hierarchical two-stage intrusion detection.

        Stage 1: Binary classification (Normal vs Attack).
        - If Normal: returns benign result immediately; Stage 2 is skipped.
        - If Attack: invokes Stage 2 (existing 10-class model) to triage specific attack category.

        Args:
            features: Dictionary or Pydantic model containing the 42 raw features.

        Returns:
            Dict containing final decision, confidence, routing path, and stage details.
        """
        # Run Stage 1 (Binary)
        stage1 = self.predict_binary(features)

        if not stage1["is_attack"]:
            # Normal: Stage 2 bypassed
            return {
                "prediction": "Normal",
                "attack_category": "Normal",
                "is_attack": False,
                "confidence": stage1["normal_probability"],
                "routing_path": "stage1_only",
                "stage1_binary": {
                    "prediction": "Normal",
                    "attack_probability": stage1["attack_probability"],
                    "threshold": stage1["threshold"],
                    "is_attack": False,
                    "raw_log_odds": stage1["raw_log_odds"],
                },
                "stage2_multiclass": None,
            }

        # Attack: Run Stage 2 (Multiclass triage)
        stage2 = self.predict(features)
        return {
            "prediction": stage2["attack_category"],
            "attack_category": stage2["attack_category"],
            "is_attack": True,
            "confidence": stage2["confidence"],
            "routing_path": "stage1_and_stage2",
            "stage1_binary": {
                "prediction": "Attack",
                "attack_probability": stage1["attack_probability"],
                "threshold": stage1["threshold"],
                "is_attack": True,
                "raw_log_odds": stage1["raw_log_odds"],
            },
            "stage2_multiclass": {
                "attack_category": stage2["attack_category"],
                "confidence": stage2["confidence"],
                "probabilities": stage2["probabilities"],
            },
        }

    def get_status(self) -> Dict[str, Any]:
        """Return a structured dictionary summarizing artifact loading status."""
        overall_ready = self.is_loaded and self.is_binary_loaded
        return {
            "status": "ready" if overall_ready else ("ready" if self.is_loaded else "error"),
            "is_loaded": self.is_loaded,
            "is_binary_loaded": self.is_binary_loaded,
            "binary_threshold": self.binary_threshold,
            "artifacts_dir": str(self.artifacts_dir),
            "artifacts": self.artifact_status,
            "classes": self.classes,
            "num_classes": len(self.classes),
            "features": {
                "raw_features_count": len(RAW_FEATURE_NAMES),
                "categorical_features_count": len(CATEGORICAL_FEATURES),
                "numerical_features_count": len(NUMERICAL_FEATURES),
                "processed_features_count": len(self.feature_names) if self.feature_names is not None else 0,
                "binary_processed_features_count": len(self.binary_feature_names) if self.binary_feature_names is not None else 0,
            },
            "errors": self.errors,
        }


# Global singleton instance for centralized access across the application
predictor: Predictor = Predictor()
