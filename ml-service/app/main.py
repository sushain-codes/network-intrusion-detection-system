"""FastAPI application for the Network Intrusion Detection ML Service.

Provides health check and service readiness reporting based on artifact loading.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.explainer import ExplanationError, explainer
from app.predictor import ModelNotLoadedError, PredictionError, predictor
from app.schemas import (
    BinaryGlobalExplanationResponse,
    BinaryLocalExplanationResponse,
    BinaryPredictionResponse,
    GlobalExplanationResponse,
    LocalExplanationResponse,
    PredictionRequest,
    PredictionResponse,
    TwoStagePredictionResponse,
)

# Configure application logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ml_service")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager to handle startup and shutdown events."""
    logger.info("Initializing ML Service and loading model artifacts...")
    success = predictor.load_artifacts()
    if success:
        logger.info("Successfully loaded ML model and all artifacts.")
        # Initialize SHAP TreeExplainer
        explainer_ok = explainer.initialize()
        if explainer_ok:
            logger.info("Successfully initialized SHAP TreeExplainer.")
        else:
            logger.warning("SHAP TreeExplainer could not be initialized at startup.")
    else:
        logger.error(
            "Failed to load one or more ML artifacts: %s",
            predictor.errors,
        )
    yield
    logger.info("ML Service shutting down.")


app = FastAPI(
    title="Network Intrusion Detection ML Service",
    description=(
        "FastAPI service for Network Intrusion Detection using XGBoost "
        "trained on the UNSW-NB15 dataset."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for local development and microservice communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["General"])
def root() -> Dict[str, str]:
    """Root endpoint welcoming clients and directing to docs and health checks."""
    return {
        "service": "Network Intrusion Detection ML Service",
        "status": "online",
        "docs_url": "/docs",
        "health_check_url": "/health",
    }


@app.get("/health", tags=["Monitoring"])
def health_check(response: Response) -> Dict[str, Any]:
    """Health check endpoint reporting artifact loading and readiness status.

    Returns HTTP 200 when all artifacts are loaded and ready, or HTTP 503
    if any required artifact is missing or failed to load.
    """
    health_status = predictor.get_status()

    if health_status["is_loaded"]:
        response.status_code = status.HTTP_200_OK
        overall_status = "healthy"
    else:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall_status = "unhealthy"

    return {
        "status": overall_status,
        "model_loaded": health_status["is_loaded"],
        "classes": health_status["classes"],
        "num_classes": health_status["num_classes"],
        "features": health_status["features"],
        "artifacts_dir": health_status["artifacts_dir"],
        "artifacts": health_status["artifacts"],
        "errors": health_status["errors"],
    }


@app.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"],
    summary="Predict network attack category",
    description=(
        "Accepts 42 raw network traffic features, applies preprocessing, "
        "and classifies the connection into one of 10 attack categories "
        "with class probabilities and confidence score."
    ),
)
def predict(request: PredictionRequest) -> PredictionResponse:
    """Classify network traffic record and return prediction with confidence and class probabilities."""
    try:
        result = predictor.predict(request)
        return PredictionResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Predict called while model is not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except PredictionError as exc:
        logger.error("Prediction error occurred: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {exc}",
        )
    except Exception as exc:
        logger.exception("Unexpected error during prediction: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected internal server error: {exc}",
        )


@app.post(
    "/predict/binary",
    response_model=BinaryPredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"],
    summary="Predict network intrusion using dedicated binary XGBoost model",
    description=(
        "Accepts 42 raw network traffic features, applies binary preprocessing, "
        "and classifies traffic as 'Normal' or 'Attack' using the tuned decision threshold T* = 0.325."
    ),
)
def predict_binary(request: PredictionRequest) -> BinaryPredictionResponse:
    """Classify network traffic into Normal vs Attack using binary model and threshold."""
    try:
        result = predictor.predict_binary(request)
        return BinaryPredictionResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Predict binary called while model is not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except PredictionError as exc:
        logger.error("Binary prediction error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Binary prediction failed: {exc}",
        )
    except Exception as exc:
        logger.exception("Unexpected error during binary prediction: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected internal server error: {exc}",
        )


@app.post(
    "/predict/two-stage",
    response_model=TwoStagePredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"],
    summary="Hierarchical two-stage network intrusion prediction",
    description=(
        "Runs binary classification first. If traffic is classified as Normal, returns immediately "
        "bypassing multiclass inference. If classified as Attack, invokes the 10-class model to triage the attack category."
    ),
)
def predict_two_stage(request: PredictionRequest) -> TwoStagePredictionResponse:
    """Run two-stage hierarchical intrusion detection with benign bypass."""
    try:
        result = predictor.predict_two_stage(request)
        return TwoStagePredictionResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Predict two-stage called while model is not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except PredictionError as exc:
        logger.error("Two-stage prediction error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Two-stage prediction failed: {exc}",
        )
    except Exception as exc:
        logger.exception("Unexpected error during two-stage prediction: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected internal server error: {exc}",
        )


@app.get(
    "/explain/global",
    response_model=GlobalExplanationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Explainability"],
    summary="Get top 20 global feature importances",
    description=(
        "Returns the top 20 features ranked by mean absolute SHAP value "
        "calculated across the dataset and stored in global_importance.npy."
    ),
)
def explain_global() -> GlobalExplanationResponse:
    """Return top 20 most influential features globally using saved SHAP importance."""
    try:
        result = explainer.get_global_explanations(top_k=20)
        return GlobalExplanationResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Global explain called while artifacts are not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except Exception as exc:
        logger.exception("Global explanation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Global explanation failed: {exc}",
        )


@app.post(
    "/explain/local",
    response_model=LocalExplanationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Explainability"],
    summary="Generate local SHAP explanation for a network connection record",
    description=(
        "Accepts 42 raw features (same request schema as /predict), predicts the attack category, "
        "and computes SHAP contributions, base value, and top 10 positive and negative feature contributions."
    ),
)
def explain_local(request: PredictionRequest) -> LocalExplanationResponse:
    """Generate record-level SHAP explanation for the predicted class."""
    try:
        result = explainer.explain_local(request, top_n=10)
        return LocalExplanationResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Local explain called while model is not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except ExplanationError as exc:
        logger.error("Local explanation error occurred: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Explanation failed: {exc}",
        )
    except Exception as exc:
        logger.exception("Unexpected error during local explanation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected internal server error: {exc}",
        )


@app.get(
    "/explain/binary/global",
    response_model=BinaryGlobalExplanationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Explainability"],
    summary="Get top 20 global feature importances for binary model",
    description=(
        "Returns the top 20 features ranked by mean absolute SHAP values calculated across 10,000 "
        "test flows using TreeExplainer. Values represent margin (log-odds) contributions, not probabilities."
    ),
)
def explain_binary_global() -> BinaryGlobalExplanationResponse:
    """Return top 20 most influential features globally for the binary XGBoost model."""
    try:
        result = explainer.get_binary_global_explanations(top_k=20)
        return BinaryGlobalExplanationResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Binary global explain called while artifacts are not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except Exception as exc:
        logger.exception("Binary global explanation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Binary global explanation failed: {exc}",
        )


@app.post(
    "/explain/binary/local",
    response_model=BinaryLocalExplanationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Explainability"],
    summary="Generate local SHAP explanation for a network record on the binary model",
    description=(
        "Accepts 42 raw features (same request schema as /predict), transforms with binary preprocessor, "
        "and computes exact TreeExplainer SHAP contributions in log-odds margin space. Verifies SHAP additivity."
    ),
)
def explain_binary_local(request: PredictionRequest) -> BinaryLocalExplanationResponse:
    """Generate record-level SHAP explanation for the binary model with additivity check."""
    try:
        result = explainer.explain_binary_local(request, top_n=10)
        return BinaryLocalExplanationResponse(**result)
    except ModelNotLoadedError as exc:
        logger.error("Binary local explain called while model is not loaded: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service unavailable: {exc}",
        )
    except ExplanationError as exc:
        logger.error("Binary local explanation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Explanation failed: {exc}",
        )
    except Exception as exc:
        logger.exception("Unexpected error during binary local explanation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected internal server error: {exc}",
        )
