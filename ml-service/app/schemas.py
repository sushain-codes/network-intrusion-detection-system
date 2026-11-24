"""Pydantic schemas for the Network Intrusion Detection ML Service.

Defines request and response schemas for feature validation, prediction,
and service monitoring based on the UNSW-NB15 dataset.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class PredictionRequest(BaseModel):
    """Request schema for network intrusion prediction.

    Validates all 42 raw input features from the UNSW-NB15 dataset.
    Requires exact feature names and valid data types. Extra or unexpected
    fields are strictly forbidden.
    """

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "dur": 2e-06,
                "proto": "rdp",
                "service": "-",
                "state": "INT",
                "spkts": 2,
                "dpkts": 0,
                "sbytes": 200,
                "dbytes": 0,
                "rate": 500000.0013,
                "sttl": 254,
                "dttl": 0,
                "sload": 400000000.0,
                "dload": 0.0,
                "sloss": 0,
                "dloss": 0,
                "sinpkt": 0.002,
                "dinpkt": 0.0,
                "sjit": 0.0,
                "djit": 0.0,
                "swin": 0,
                "stcpb": 0,
                "dtcpb": 0,
                "dwin": 0,
                "tcprtt": 0.0,
                "synack": 0.0,
                "ackdat": 0.0,
                "smean": 100,
                "dmean": 0,
                "trans_depth": 0,
                "response_body_len": 0,
                "ct_srv_src": 6,
                "ct_state_ttl": 2,
                "ct_dst_ltm": 3,
                "ct_src_dport_ltm": 3,
                "ct_dst_sport_ltm": 3,
                "ct_dst_src_ltm": 6,
                "is_ftp_login": 0,
                "ct_ftp_cmd": 0,
                "ct_flw_http_mthd": 0,
                "ct_src_ltm": 3,
                "ct_srv_dst": 6,
                "is_sm_ips_ports": 0,
            }
        },
    )

    # Categorical features (3)
    proto: str = Field(..., description="Transaction protocol (e.g. tcp, udp, rdp, unas)")
    service: str = Field(..., description="Network service (e.g. -, http, ftp, dns, smtp)")
    state: str = Field(..., description="Connection state (e.g. FIN, INT, CON, REQ, RST)")

    # Numerical float features (11)
    dur: float = Field(..., description="Record total duration (seconds)")
    rate: float = Field(..., description="Pps (packets per second)")
    sload: float = Field(..., description="Source bits per second")
    dload: float = Field(..., description="Destination bits per second")
    sinpkt: float = Field(..., description="Source interpacket arrival time (mSec)")
    dinpkt: float = Field(..., description="Destination interpacket arrival time (mSec)")
    sjit: float = Field(..., description="Source jitter (mSec)")
    djit: float = Field(..., description="Destination jitter (mSec)")
    tcprtt: float = Field(..., description="TCP round trip time (seconds), sum of synack and ackdat")
    synack: float = Field(..., description="TCP connection setup time (syn to syn-ack)")
    ackdat: float = Field(..., description="TCP connection setup time (syn-ack to ack)")

    # Numerical integer features (28)
    spkts: int = Field(..., description="Source to destination packet count")
    dpkts: int = Field(..., description="Destination to source packet count")
    sbytes: int = Field(..., description="Source to destination transaction bytes")
    dbytes: int = Field(..., description="Destination to source transaction bytes")
    sttl: int = Field(..., description="Source to destination time to live value")
    dttl: int = Field(..., description="Destination to source time to live value")
    sloss: int = Field(..., description="Source packets retransmitted or dropped")
    dloss: int = Field(..., description="Destination packets retransmitted or dropped")
    swin: int = Field(..., description="Source TCP window advertisement value")
    stcpb: int = Field(..., description="Source TCP base sequence number")
    dtcpb: int = Field(..., description="Destination TCP base sequence number")
    dwin: int = Field(..., description="Destination TCP window advertisement value")
    smean: int = Field(..., description="Mean of the packet size transmitted by the source")
    dmean: int = Field(..., description="Mean of the packet size transmitted by the destination")
    trans_depth: int = Field(..., description="Pipelined HTTP request/response count")
    response_body_len: int = Field(..., description="Actual uncompressed content size of HTTP response")
    ct_srv_src: int = Field(..., description="Connections with same service and source address in 100 records")
    ct_state_ttl: int = Field(..., description="Connections according to state and TTL ranges")
    ct_dst_ltm: int = Field(..., description="Connections to destination address in last 100 records")
    ct_src_dport_ltm: int = Field(..., description="Connections from source to destination port in 100 records")
    ct_dst_sport_ltm: int = Field(..., description="Connections from destination to source port in 100 records")
    ct_dst_src_ltm: int = Field(..., description="Connections with same source and destination address in 100 records")
    is_ftp_login: int = Field(..., description="1 if FTP session accessed by user/password, 0 otherwise")
    ct_ftp_cmd: int = Field(..., description="Number of flow commands in FTP session")
    ct_flw_http_mthd: int = Field(..., description="Number of flows that use HTTP methods (GET, POST)")
    ct_src_ltm: int = Field(..., description="Connections to source address in last 100 records")
    ct_srv_dst: int = Field(..., description="Connections with same service and destination address in 100 records")
    is_sm_ips_ports: int = Field(..., description="1 if source and destination IP and port equal, 0 otherwise")

    @model_validator(mode="before")
    @classmethod
    def unwrap_features_if_nested(cls, data: Any) -> Any:
        """Allow requests wrapped in an optional {'features': {...}} dictionary."""
        if isinstance(data, dict) and "features" in data and isinstance(data["features"], dict) and len(data) == 1:
            return data["features"]
        return data

    @model_validator(mode="after")
    def validate_finite_and_valid(self) -> PredictionRequest:
        """Ensure all numeric features are finite numbers and strings are not empty."""
        for field_name, value in self.__dict__.items():
            if isinstance(value, float):
                if math.isnan(value) or math.isinf(value):
                    raise ValueError(f"Feature '{field_name}' must be a finite number, received {value}")
            elif isinstance(value, str):
                if not value.strip():
                    raise ValueError(f"Feature '{field_name}' must not be empty or whitespace only")
        return self


class PredictionResponse(BaseModel):
    """Response schema returning prediction results."""

    attack_category: str = Field(..., description="Predicted attack category name")
    confidence: float = Field(..., description="Confidence score of the predicted class")
    probabilities: Dict[str, float] = Field(
        ...,
        description="Predicted probability distribution across all 10 attack classes",
    )
    prediction: str = Field(
        ...,
        description="Alias for attack_category for API compatibility",
    )


class GlobalFeatureImportance(BaseModel):
    """Importance metric for a single feature."""

    feature: str = Field(..., description="Feature name")
    importance: float = Field(..., description="Mean absolute SHAP value importance score")
    rank: int = Field(..., description="Rank among all features (1 is most important)")


class GlobalExplanationResponse(BaseModel):
    """Response schema returning top 20 global features."""

    top_features: List[GlobalFeatureImportance] = Field(
        ..., description="Top 20 global features ranked by mean absolute SHAP value"
    )
    importance_scores: Dict[str, float] = Field(
        ..., description="Dictionary mapping feature names to their importance score"
    )
    total_features: int = Field(
        ..., description="Total number of processed features (194)"
    )


class LocalFeatureContribution(BaseModel):
    """SHAP contribution of a single feature for a specific record."""

    feature: str = Field(..., description="Feature name")
    shap_value: float = Field(..., description="SHAP value contribution for the predicted class")
    feature_value: Optional[float] = Field(
        None, description="Value of this feature for the evaluated record"
    )


class LocalExplanationResponse(BaseModel):
    """Response schema returning record-level local SHAP explanation."""

    predicted_class: str = Field(..., description="Predicted attack category name")
    base_value: float = Field(..., description="Base (expected) logit value for the predicted class")
    contributions: Dict[str, float] = Field(
        ..., description="SHAP contributions for all 194 features for the predicted class"
    )
    feature_contributions: Dict[str, float] = Field(
        ..., description="Alias for contributions"
    )
    top_positive: List[LocalFeatureContribution] = Field(
        ..., description="Top 10 features with positive contributions towards the predicted class"
    )
    top_negative: List[LocalFeatureContribution] = Field(
        ..., description="Top 10 features with negative contributions away from the predicted class"
    )
    confidence: float = Field(..., description="Prediction confidence score")
    prediction: str = Field(..., description="Alias for predicted_class")
    attack_category: str = Field(..., description="Alias for predicted_class")
    class_index: int = Field(..., description="Index of the predicted class in label encoder")


# =============================================================================
# Binary Model & Two-Stage Prediction Schemas
# =============================================================================

class BinaryPredictionResponse(BaseModel):
    """Response schema returning binary intrusion detection results."""

    prediction: str = Field(..., description="Predicted class: 'Normal' or 'Attack'")
    attack_category: str = Field(..., description="Binary attack category ('Normal' or 'Attack')")
    is_attack: bool = Field(..., description="True if classified as attack, False if Normal")
    attack_probability: float = Field(..., description="Predicted probability of attack P(Attack)")
    normal_probability: float = Field(..., description="Predicted probability of normal traffic 1 - P(Attack)")
    threshold: float = Field(..., description="Operating decision threshold T* loaded from configuration")
    raw_log_odds: float = Field(..., description="Raw continuous margin score (log-odds) before sigmoid transformation")


class Stage1BinaryResult(BaseModel):
    """Output summary of Stage 1 binary classifier."""

    prediction: str = Field(..., description="Stage 1 prediction: 'Normal' or 'Attack'")
    attack_probability: float = Field(..., description="Predicted probability of attack")
    threshold: float = Field(..., description="Operating decision threshold T*")
    is_attack: bool = Field(..., description="True if stage 1 flagged an attack")
    raw_log_odds: float = Field(..., description="Raw log-odds margin score")


class Stage2MulticlassResult(BaseModel):
    """Output summary of Stage 2 10-class model."""

    attack_category: str = Field(..., description="Triage attack category (e.g. Exploits, DoS, Generic)")
    confidence: float = Field(..., description="Top class confidence score from 10-class model")
    probabilities: Dict[str, float] = Field(
        ..., description="Probability distribution across all 10 attack classes"
    )


class TwoStagePredictionResponse(BaseModel):
    """Response schema for two-stage hierarchical intrusion detection."""

    prediction: str = Field(
        ..., description="Final decision: 'Normal' if stage 1 is normal, else predicted attack class from stage 2"
    )
    attack_category: str = Field(..., description="Alias for prediction")
    is_attack: bool = Field(..., description="True if classified as attack by Stage 1")
    confidence: float = Field(..., description="Confidence score of the final prediction")
    routing_path: str = Field(
        ..., description="Execution path: 'stage1_only' (benign bypass) or 'stage1_and_stage2' (attack triage)"
    )
    stage1_binary: Stage1BinaryResult = Field(..., description="Detailed Stage 1 binary output")
    stage2_multiclass: Optional[Stage2MulticlassResult] = Field(
        None, description="Detailed Stage 2 output (only executed if Stage 1 detects an Attack)"
    )


class BinaryGlobalFeatureImportance(BaseModel):
    """Global feature importance metric for the binary XGBoost model."""

    rank: int = Field(..., description="Global importance rank (1 = most influential)")
    raw_feature_name: str = Field(..., description="Encoded feature name (e.g. num__sttl)")
    clean_name: str = Field(..., description="Clean feature column name")
    type: str = Field(..., description="Feature type: Numerical or Categorical")
    mean_abs_shap: float = Field(..., description="Mean absolute SHAP value in log-odds space")
    primary_direction: str = Field(..., description="Primary impact direction (e.g. Positive -> Attack)")


class BinaryGlobalExplanationResponse(BaseModel):
    """Response schema returning top 20 global features for the binary model."""

    top_features: List[BinaryGlobalFeatureImportance] = Field(
        ..., description="Top 20 global features ranked by mean absolute SHAP value"
    )
    importance_scores: Dict[str, float] = Field(
        ..., description="Dictionary mapping raw feature names to mean |SHAP|"
    )
    total_features: int = Field(
        ..., description="Total number of binary model features (194)"
    )
    base_value_log_odds: float = Field(
        ..., description="Baseline expected value phi_0 in log-odds"
    )
    base_value_probability: float = Field(
        ..., description="Baseline attack probability sigmoid(phi_0)"
    )
    chosen_decision_threshold: float = Field(
        ..., description="Tuned decision threshold T* loaded from binary_threshold.json"
    )
    units: str = Field(
        default="raw log-odds (margin contributions: margin = base_value + sum(SHAP), P = sigmoid(margin)); not probabilities",
        description="Explanation of SHAP value units",
    )


class BinaryLocalFeatureContribution(BaseModel):
    """SHAP contribution of a single feature for the binary model."""

    feature: str = Field(..., description="Encoded feature name")
    shap_value: float = Field(
        ..., description="Raw log-odds contribution (positive pushes toward Attack, negative toward Normal)"
    )
    feature_value: Optional[float] = Field(
        None, description="Transformed numeric feature value"
    )
    raw_input_value: Optional[Any] = Field(
        None, description="Original raw feature value before transformation"
    )


class BinaryLocalExplanationResponse(BaseModel):
    """Response schema returning record-level local SHAP explanation for the binary model."""

    prediction: str = Field(..., description="Predicted class ('Normal' or 'Attack')")
    is_attack: bool = Field(..., description="True if Attack, False if Normal")
    attack_probability: float = Field(..., description="Predicted attack probability P(Attack)")
    raw_log_odds_margin: float = Field(..., description="Raw margin score phi (log-odds)")
    base_value: float = Field(..., description="Baseline expected log-odds phi_0")
    sum_of_shap_values: float = Field(..., description="Sum of all feature SHAP contributions")
    additivity_error: float = Field(
        ..., description="Absolute difference between margin and (base_value + sum(SHAP))"
    )
    additivity_verified: bool = Field(
        ..., description="True if additivity holds within numerical tolerance (< 1e-4)"
    )
    threshold: float = Field(..., description="Decision threshold T*")
    units: str = Field(
        default="raw log-odds margin contributions (additive in logit space: margin = base_value + sum(SHAP), P = sigmoid(margin)); not probabilities",
        description="Explanation of SHAP value units",
    )
    top_positive: List[BinaryLocalFeatureContribution] = Field(
        ..., description="Top features pushing log-odds toward Attack (positive SHAP)"
    )
    top_negative: List[BinaryLocalFeatureContribution] = Field(
        ..., description="Top features pushing log-odds toward Normal (negative SHAP)"
    )
    contributions: Dict[str, float] = Field(
        ..., description="Full map of all 194 features to their raw SHAP log-odds contributions"
    )



