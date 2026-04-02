import json
import logging
import re
import warnings
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple, Any

import numpy as np
import torch
import torch.nn as nn
import torchvision
from PIL import Image
from torchvision import transforms
from torchvision.models import ResNet18_Weights
from transformers import GenerationConfig, TrOCRProcessor, VisionEncoderDecoderConfig, VisionEncoderDecoderModel
import pytesseract

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)

class MLConfig:
    classifier_img_size: int = 224
    ocr_model_name: str = "microsoft/trocr-base-printed"
    ocr_max_target_length: int = 32
    ocr_num_beams: int = 1
    ocr_page_lang: str = "eng"
    ocr_page_min_conf: int = 40
    ocr_page_min_box_size: int = 8
    ocr_page_max_words: int = 500
    ocr_page_pad: int = 4
    ocr_page_batch_size: int = 8
    ocr_word_level_max_crops: int = 64


config = MLConfig()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BASE_DIR = Path(__file__).parent
CLASSIFIER_PATH = BASE_DIR / "models" / "classifier_resnet18" / "classifier_finetuned_best.pt"
CLASS_NAMES_PATH = BASE_DIR / "models" / "classifier_resnet18" / "class_names.json"
OCR_PATH = BASE_DIR / "models" / "ocr_trocr_funsd" / "ocr_best.pt"
OCR_CONFIG_PATH = OCR_PATH.parent / "config.json"
OCR_GENERATION_CONFIG_PATH = OCR_PATH.parent / "generation_config.json"

_classifier_model: Optional[nn.Module] = None
_class_names: Optional[List[str]] = None
_ocr_model: Optional[nn.Module] = None
_ocr_processor: Optional[TrOCRProcessor] = None
_models_loaded: bool = False
ProgressCallback = Optional[Callable[[int, str, Optional[Dict[str, Any]]], None]]


class DocumentClassifier(nn.Module):
    def __init__(self, num_classes: int, freeze_backbone: bool = False):
        super().__init__()
        backbone = torchvision.models.resnet18(weights=ResNet18_Weights.DEFAULT)
        in_features = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.classifier = nn.Linear(in_features, num_classes)

        if freeze_backbone:
            for p in self.backbone.parameters():
                p.requires_grad = False

    def forward(self, x):
        feats = self.backbone(x)
        return self.classifier(feats)


eval_transform = transforms.Compose([
    transforms.Resize((config.classifier_img_size, config.classifier_img_size)),
    transforms.ToTensor(),
    transforms.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
])


def _extract_state_dict(ckpt: Any) -> Dict[str, Any]:
    if isinstance(ckpt, dict):
        for key in ("state_dict", "model_state_dict", "model", "net"):
            if key in ckpt and isinstance(ckpt[key], dict):
                ckpt = ckpt[key]
                break
    if not isinstance(ckpt, dict):
        raise TypeError(f"Unsupported checkpoint type: {type(ckpt)!r}")
    return ckpt


def _strip_module_prefix(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    if any(k.startswith("module.") for k in state_dict.keys()):
        return {k.replace("module.", "", 1): v for k, v in state_dict.items()}
    return state_dict


def _remap_linear_head_keys(state_dict: Dict[str, Any], model: nn.Module) -> Dict[str, Any]:
    model_keys = list(model.state_dict().keys())
    model_has_head = any(k.startswith("head.") for k in model_keys)
    model_has_classifier = any(k.startswith("classifier.") for k in model_keys)

    ckpt_has_head = any(k.startswith("head.") for k in state_dict.keys())
    ckpt_has_classifier = any(k.startswith("classifier.") for k in state_dict.keys())

    remapped = dict(state_dict)

    if model_has_classifier and ckpt_has_head and not ckpt_has_classifier:
        remapped = {
            (k.replace("head.", "classifier.", 1) if k.startswith("head.") else k): v
            for k, v in remapped.items()
        }
    elif model_has_head and ckpt_has_classifier and not ckpt_has_head:
        remapped = {
            (k.replace("classifier.", "head.", 1) if k.startswith("classifier.") else k): v
            for k, v in remapped.items()
        }

    return remapped


def load_classifier() -> Tuple[nn.Module, List[str]]:
    global _classifier_model, _class_names

    if _classifier_model is not None and _class_names is not None:
        return _classifier_model, _class_names

    if not CLASS_NAMES_PATH.exists():
        raise FileNotFoundError(f"Class names file not found: {CLASS_NAMES_PATH}")
    if not CLASSIFIER_PATH.exists():
        raise FileNotFoundError(f"Classifier weights not found: {CLASSIFIER_PATH}")

    logger.info("Loading classifier model...")
    logger.info("Classifier classes path: %s", CLASS_NAMES_PATH.resolve())
    logger.info(
        "Classifier weights path: %s (exists=%s, size_mb=%.2f)",
        CLASSIFIER_PATH.resolve(),
        CLASSIFIER_PATH.exists(),
        CLASSIFIER_PATH.stat().st_size / (1024 * 1024),
    )
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)

    model = DocumentClassifier(num_classes=len(class_names), freeze_backbone=False).to(device)
    checkpoint = torch.load(CLASSIFIER_PATH, map_location=device)
    state_dict = _extract_state_dict(checkpoint)
    state_dict = _strip_module_prefix(state_dict)
    state_dict = _remap_linear_head_keys(state_dict, model)

    model.load_state_dict(state_dict, strict=False)
    model.eval()

    _classifier_model = model
    _class_names = class_names
    logger.info("Classifier loaded. Classes: %s", class_names)
    return model, class_names


def load_ocr() -> Tuple[nn.Module, TrOCRProcessor]:
    global _ocr_model, _ocr_processor

    if _ocr_model is not None and _ocr_processor is not None:
        return _ocr_model, _ocr_processor

    if not OCR_PATH.exists():
        raise FileNotFoundError(f"OCR weights not found: {OCR_PATH}")
    if not OCR_CONFIG_PATH.exists():
        raise FileNotFoundError(f"OCR config not found: {OCR_CONFIG_PATH}")
    if not OCR_GENERATION_CONFIG_PATH.exists():
        raise FileNotFoundError(f"OCR generation config not found: {OCR_GENERATION_CONFIG_PATH}")

    logger.info("Loading OCR model...")
    logger.info(
        "OCR weights path: %s (exists=%s, size_mb=%.2f)",
        OCR_PATH.resolve(),
        OCR_PATH.exists(),
        OCR_PATH.stat().st_size / (1024 * 1024),
    )
    logger.info(
        "OCR tokenizer path: %s (exists=%s)",
        OCR_PATH.parent.resolve(),
        OCR_PATH.parent.exists(),
    )
    logger.info(
        "Loading TrOCR processor from local directory: %s",
        OCR_PATH.parent.resolve(),
    )
    processor = TrOCRProcessor.from_pretrained(str(OCR_PATH.parent), local_files_only=True)
    logger.info(
        "Loading TrOCR model config from local directory: %s",
        OCR_PATH.parent.resolve(),
    )
    model_config = VisionEncoderDecoderConfig.from_pretrained(
        str(OCR_PATH.parent),
        local_files_only=True,
    )
    model = VisionEncoderDecoderModel(model_config)
    model.generation_config = GenerationConfig.from_pretrained(
        str(OCR_PATH.parent),
        local_files_only=True,
    )

    pad_token_id = processor.tokenizer.pad_token_id
    decoder_start_token_id = (
        processor.tokenizer.bos_token_id
        if processor.tokenizer.bos_token_id is not None
        else processor.tokenizer.cls_token_id
    )
    eos_token_id = processor.tokenizer.eos_token_id
    if eos_token_id is None:
        eos_token_id = processor.tokenizer.sep_token_id

    model.config.pad_token_id = pad_token_id
    model.config.decoder_start_token_id = decoder_start_token_id
    model.config.eos_token_id = eos_token_id
    model.config.vocab_size = model.config.decoder.vocab_size
    model.config.use_cache = False

    checkpoint = torch.load(OCR_PATH, map_location=device)
    state_dict = _extract_state_dict(checkpoint)
    state_dict = _strip_module_prefix(state_dict)
    model.load_state_dict(state_dict, strict=True)
    model = model.to(device)
    model.eval()

    _ocr_model = model
    _ocr_processor = processor
    logger.info("OCR model loaded successfully")
    return model, processor


def initialize_models():
    global _models_loaded
    if not _models_loaded:
        logger.info("=" * 50)
        logger.info("Initializing ML models...")
        logger.info("ML device: %s", device)
        logger.info("Classifier checkpoint target: %s", CLASSIFIER_PATH.resolve())
        logger.info("OCR checkpoint target: %s", OCR_PATH.resolve())
        logger.info("=" * 50)
        try:
            load_classifier()
            load_ocr()
            _models_loaded = True
            logger.info("=" * 50)
            logger.info("ML models initialized successfully")
            logger.info("=" * 50)
        except Exception as e:
            logger.warning("Failed to initialize ML models: %s", e, exc_info=True)
            logger.warning("ML features will be disabled")


def is_models_ready() -> bool:
    return _models_loaded


def get_model_health() -> Dict[str, Any]:
    return {
        "device": str(device),
        "models_loaded": _models_loaded,
        "classifier": {
            "weights_path": str(CLASSIFIER_PATH.resolve()),
            "weights_exists": CLASSIFIER_PATH.exists(),
            "weights_size_mb": round(CLASSIFIER_PATH.stat().st_size / (1024 * 1024), 2) if CLASSIFIER_PATH.exists() else None,
            "class_names_path": str(CLASS_NAMES_PATH.resolve()),
            "class_names_exists": CLASS_NAMES_PATH.exists(),
            "loaded": _classifier_model is not None and _class_names is not None,
            "class_count": len(_class_names) if _class_names is not None else None,
        },
        "ocr": {
            "weights_path": str(OCR_PATH.resolve()),
            "weights_exists": OCR_PATH.exists(),
            "weights_size_mb": round(OCR_PATH.stat().st_size / (1024 * 1024), 2) if OCR_PATH.exists() else None,
            "tokenizer_dir": str(OCR_PATH.parent.resolve()),
            "tokenizer_dir_exists": OCR_PATH.parent.exists(),
            "config_path": str(OCR_CONFIG_PATH.resolve()),
            "config_exists": OCR_CONFIG_PATH.exists(),
            "generation_config_path": str(OCR_GENERATION_CONFIG_PATH.resolve()),
            "generation_config_exists": OCR_GENERATION_CONFIG_PATH.exists(),
            "processor_loaded": _ocr_processor is not None,
            "model_loaded": _ocr_model is not None,
            "offline_only": True,
        },
        "tesseract": {
            "available": _is_tesseract_available(),
        },
    }


def _is_tesseract_available() -> bool:
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _emit_progress(progress_callback: ProgressCallback, percent: int, stage: str, details: Optional[Dict[str, Any]] = None):
    if progress_callback is not None:
        progress_callback(percent, stage, details)


def normalize_text(text: Optional[str]) -> str:
    if text is None:
        return ""
    text = str(text)
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def detect_text_boxes_tesseract(
    image: Image.Image,
) -> List[Dict[str, Any]]:
    lang = config.ocr_page_lang
    min_conf = config.ocr_page_min_conf
    min_box_size = config.ocr_page_min_box_size
    max_words = config.ocr_page_max_words

    data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
    detections: List[Dict[str, Any]] = []

    for i in range(len(data["text"])):
        text = normalize_text(data["text"][i])
        if not text:
            continue

        try:
            conf = float(data["conf"][i])
        except Exception:
            conf = -1.0

        if conf < min_conf:
            continue

        x = int(data["left"][i])
        y = int(data["top"][i])
        w = int(data["width"][i])
        h = int(data["height"][i])

        if w < min_box_size or h < min_box_size:
            continue

        detections.append(
            {
                "x0": x,
                "y0": y,
                "x1": x + w,
                "y1": y + h,
                "text": text,
                "conf": conf,
                "block_num": int(data["block_num"][i]),
                "par_num": int(data["par_num"][i]),
                "line_num": int(data["line_num"][i]),
                "word_num": int(data["word_num"][i]),
            }
        )

    detections.sort(
        key=lambda d: (
            d["block_num"],
            d["par_num"],
            d["line_num"],
            d["y0"],
            d["x0"],
        )
    )
    if len(detections) > max_words:
        detections = detections[:max_words]
    return detections


def crop_with_padding(image: Image.Image, box: Tuple[int, int, int, int], pad: int = None) -> Image.Image:
    if pad is None:
        pad = config.ocr_page_pad
    width, height = image.size
    x0, y0, x1, y1 = box
    x0 = max(0, int(x0) - pad)
    y0 = max(0, int(y0) - pad)
    x1 = min(width, int(x1) + pad)
    y1 = min(height, int(y1) + pad)
    if x1 <= x0 or y1 <= y0:
        return image.crop((0, 0, 1, 1)).convert("RGB")
    return image.crop((x0, y0, x1, y1)).convert("RGB")


def generate_text_for_crops(
    crops: List[Image.Image],
    model: nn.Module,
    processor: TrOCRProcessor,
    progress_callback: ProgressCallback = None,
) -> List[str]:
    batch_size = config.ocr_page_batch_size
    max_length = config.ocr_max_target_length
    num_beams = config.ocr_num_beams

    preds: List[str] = []
    if len(crops) == 0:
        return preds

    logger.info(
        "Starting word-level OCR generation for %s crops with batch_size=%s",
        len(crops),
        batch_size,
    )
    for start in range(0, len(crops), batch_size):
        batch_crops = crops[start: start + batch_size]
        completed = start
        percent = 60 + int((completed / len(crops)) * 30)
        _emit_progress(
            progress_callback,
            percent,
            "ocr_generating",
            {
                "completed_crops": completed,
                "total_crops": len(crops),
                "batch_start": start + 1,
                "batch_end": start + len(batch_crops),
            },
        )
        logger.info(
            "OCR batch %s-%s of %s",
            start + 1,
            start + len(batch_crops),
            len(crops),
        )
        pixel_values = processor(images=batch_crops, return_tensors="pt").pixel_values.to(device)
        with torch.no_grad():
            generated_ids = model.generate(
                pixel_values,
                max_length=max_length,
                num_beams=num_beams,
            )
        batch_preds = processor.batch_decode(generated_ids, skip_special_tokens=True)
        preds.extend([normalize_text(p) for p in batch_preds])

    _emit_progress(
        progress_callback,
        90,
        "ocr_generating",
        {
            "completed_crops": len(crops),
            "total_crops": len(crops),
        },
    )

    return preds


def ocr_full_page(
    image: Image.Image,
    model: nn.Module,
    processor: TrOCRProcessor,
    progress_callback: ProgressCallback = None,
) -> str:
    logger.info("Starting OCR full-page pipeline")
    _emit_progress(progress_callback, 45, "ocr_detecting", {"message": "Detecting text boxes"})
    detections = detect_text_boxes_tesseract(image)
    logger.info("Tesseract detected %s candidate text boxes", len(detections))
    _emit_progress(
        progress_callback,
        55,
        "ocr_detecting",
        {"detected_boxes": len(detections)},
    )

    if len(detections) == 0:
        logger.info("No text boxes detected, using full-page Tesseract fallback")
        _emit_progress(progress_callback, 80, "ocr_fallback", {"reason": "no_text_boxes"})
        return normalize_text(pytesseract.image_to_string(image, lang=config.ocr_page_lang))

    if len(detections) > config.ocr_word_level_max_crops:
        logger.warning(
            "Detected %s text boxes, exceeding limit %s. Using full-page Tesseract fallback to avoid long OCR processing.",
            len(detections),
            config.ocr_word_level_max_crops,
        )
        _emit_progress(
            progress_callback,
            80,
            "ocr_fallback",
            {
                "reason": "too_many_text_boxes",
                "detected_boxes": len(detections),
                "limit": config.ocr_word_level_max_crops,
            },
        )
        return normalize_text(pytesseract.image_to_string(image, lang=config.ocr_page_lang))

    crops = [
        crop_with_padding(image, (d["x0"], d["y0"], d["x1"], d["y1"]))
        for d in detections
    ]
    pred_words = generate_text_for_crops(crops, model, processor, progress_callback=progress_callback)

    if len(pred_words) != len(detections):
        pred_words = (pred_words + [""] * len(detections))[:len(detections)]

    for det, pred in zip(detections, pred_words):
        det["ocr_text"] = pred

    line_groups: Dict[Tuple[int, int, int], List[Dict[str, Any]]] = {}
    for det in detections:
        key = (det["block_num"], det["par_num"], det["line_num"])
        line_groups.setdefault(key, []).append(det)

    ordered_lines = []
    for key in sorted(line_groups.keys()):
        line_items = sorted(line_groups[key], key=lambda d: (d["x0"], d["word_num"]))
        line_text = normalize_text(" ".join([d["ocr_text"] for d in line_items if d["ocr_text"]]))
        if line_text:
            ordered_lines.append(line_text)

    full_text = normalize_text("\n".join(ordered_lines))
    if not full_text:
        logger.info("Word-level OCR returned empty text, using full-page Tesseract fallback")
        _emit_progress(progress_callback, 85, "ocr_fallback", {"reason": "empty_word_level_result"})
        full_text = normalize_text(pytesseract.image_to_string(image, lang=config.ocr_page_lang))

    logger.info("OCR full-page pipeline complete. Extracted text length=%s", len(full_text))
    _emit_progress(progress_callback, 92, "ocr_complete", {"text_length": len(full_text)})
    return full_text


def predict_category_with_confidence(image: Image.Image, progress_callback: ProgressCallback = None) -> Tuple[str, float]:
    if not _models_loaded:
        raise RuntimeError("ML models not initialized. Please wait for server startup.")
    classifier, class_names = load_classifier()
    logger.info("Running classifier inference on image size=%s", image.size)
    _emit_progress(progress_callback, 30, "classification", {"image_size": list(image.size)})
    clf_input = eval_transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = classifier(clf_input)
        probs = torch.softmax(logits, dim=1)[0]
        pred_idx = int(torch.argmax(probs).item())
        pred_class = class_names[pred_idx]
        confidence = float(probs[pred_idx].item())
    _emit_progress(
        progress_callback,
        40,
        "classification_complete",
        {"predicted_class": pred_class, "confidence": confidence},
    )
    return pred_class, confidence


def extract_ocr_text(image: Image.Image, progress_callback: ProgressCallback = None) -> str:
    if not _models_loaded:
        raise RuntimeError("ML models not initialized. Please wait for server startup.")
    ocr_model, ocr_processor = load_ocr()
    logger.info("Running OCR inference on image size=%s", image.size)
    _emit_progress(progress_callback, 42, "ocr_start", {"image_size": list(image.size)})
    return ocr_full_page(image, ocr_model, ocr_processor, progress_callback=progress_callback)


def predict_category(filename: str, mime_type: str = None) -> str:
    from pathlib import Path
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return "Misc"
    return "Misc"
