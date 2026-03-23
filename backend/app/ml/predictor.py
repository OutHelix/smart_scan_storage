"""Lightweight document category classifier using scikit-learn."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

FALLBACK_CATEGORY = "Misc"


@dataclass(frozen=True)
class Sample:
    text: str
    label: str


_TRAIN_SAMPLES: list[Sample] = [
    # Invoices
    Sample("invoice april 2025 supplier payment total vat pdf", "Invoices"),
    Sample("tax invoice billing statement amount due", "Invoices"),
    Sample("счет на оплату поставщик сумма ндс", "Invoices"),
    Sample("invoice_001 company acme", "Invoices"),
    # Contracts
    Sample("service contract signed agreement terms annex", "Contracts"),
    Sample("employment contract addendum signature", "Contracts"),
    Sample("договор оказания услуг приложение подписи", "Contracts"),
    Sample("nda agreement confidential contract", "Contracts"),
    # Receipts
    Sample("store receipt purchase total card payment", "Receipts"),
    Sample("cash receipt supermarket items", "Receipts"),
    Sample("чек магазин покупка сумма", "Receipts"),
    Sample("receipt photo img 2024", "Receipts"),
    # ID Documents
    Sample("passport id card identity document", "ID Documents"),
    Sample("driver license national id scan", "ID Documents"),
    Sample("паспорт гражданина удостоверение личности", "ID Documents"),
    Sample("visa identity scan document", "ID Documents"),
    # Misc
    Sample("notes random file attachment document", "Misc"),
    Sample("presentation slides draft report", "Misc"),
    Sample("прочее документ без категории", "Misc"),
    Sample("scan image file upload", "Misc"),
]


def _normalize_filename(filename: str) -> str:
    cleaned = filename.lower()
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\.[a-z0-9]+$", "", cleaned)
    return cleaned


def _build_features(filename: str, mime_type: str | None) -> str:
    base = _normalize_filename(filename)
    mime = mime_type or "unknown"
    return f"{base} mime:{mime}"


_MODEL = None
_MODEL_READY = False


def _init_model() -> None:
    """Train once at import time; keep model in memory."""
    global _MODEL_READY, _MODEL
    if _MODEL_READY:
        return
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
    except Exception as e:  # noqa: BLE001
        logger.warning("scikit-learn not available, ML fallback enabled: %s", e)
        _MODEL_READY = False
        _MODEL = None
        return

    X = [s.text for s in _TRAIN_SAMPLES]
    y = [s.label for s in _TRAIN_SAMPLES]
    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
            ("clf", LogisticRegression(max_iter=500)),
        ]
    )
    model.fit(X, y)
    _MODEL = model
    _MODEL_READY = True
    logger.info("Document ML model initialized with %d samples", len(_TRAIN_SAMPLES))


def _fallback_predict(filename: str, mime_type: str | None) -> str:
    """Safe fallback if ML is unavailable."""
    name = filename.lower()
    if any(k in name for k in ("invoice", "счет", "счёт", "billing")):
        return "Invoices"
    if any(k in name for k in ("contract", "agreement", "договор", "nda")):
        return "Contracts"
    if any(k in name for k in ("receipt", "чек", "kvittung", "purchase")):
        return "Receipts"
    if any(k in name for k in ("passport", "identity", "license", "удостоверение", "паспорт")):
        return "ID Documents"
    if mime_type and mime_type.startswith("image/") and any(k in name for k in ("img", "scan", "photo")):
        return "Receipts"
    return FALLBACK_CATEGORY


def predict_category(filename: str, mime_type: str | None) -> str:
    """Predict category name using trained model; fallback if needed."""
    _init_model()
    if not _MODEL_READY or _MODEL is None:
        return _fallback_predict(filename, mime_type)

    try:
        features = _build_features(filename, mime_type)
        pred = _MODEL.predict([features])[0]
        return str(pred)
    except Exception as e:  # noqa: BLE001
        logger.warning("ML inference failed, fallback in use: %s", e)
        return _fallback_predict(filename, mime_type)
