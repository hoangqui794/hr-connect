from functools import lru_cache
from threading import BoundedSemaphore
from typing import Protocol
from dataclasses import dataclass

import numpy as np
from PIL import Image

from app.core.config import get_settings


@dataclass(frozen=True)
class OcrLine:
    text: str
    bbox: tuple[float, float, float, float]


class OcrEngine(Protocol):
    def read_text(self, image: Image.Image) -> str: ...

    def read_lines(self, image: Image.Image) -> list[OcrLine]: ...


class EasyOcrEngine:
    def __init__(self, languages: list[str], max_concurrency: int = 1) -> None:
        self._languages = languages
        self._reader = None
        self._semaphore = BoundedSemaphore(max_concurrency)

    @property
    def reader(self):
        if self._reader is None:
            import easyocr

            self._reader = easyocr.Reader(self._languages, gpu=False)
        return self._reader

    def read_text(self, image: Image.Image) -> str:
        with self._semaphore:
            lines = self.reader.readtext(np.asarray(image.convert("RGB")), detail=0, paragraph=True)
        return "\n".join(str(line).strip() for line in lines if str(line).strip())

    def read_lines(self, image: Image.Image) -> list[OcrLine]:
        with self._semaphore:
            results = self.reader.readtext(np.asarray(image.convert("RGB")), detail=1, paragraph=False)
        lines: list[OcrLine] = []
        for bbox, text, _confidence in results:
            value = str(text).strip()
            if not value or len(bbox) != 4:
                continue
            xs = [float(point[0]) for point in bbox]
            ys = [float(point[1]) for point in bbox]
            lines.append(OcrLine(value, (min(xs), min(ys), max(xs), max(ys))))
        return lines


@lru_cache(maxsize=1)
def get_ocr_engine() -> OcrEngine:
    settings = get_settings()
    languages = [item.strip() for item in settings.ocr_languages.split(",") if item.strip()]
    return EasyOcrEngine(languages or ["vi", "en"], settings.ocr_max_concurrency)
