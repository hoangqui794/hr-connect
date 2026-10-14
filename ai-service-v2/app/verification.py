"""Check that every quote the model returned really occurs in the CV.

Comparison ignores case, accents-normalisation differences, PDF ligatures, punctuation and line breaks, because
the same sentence extracted by different readers differs in exactly those ways.
"""

from __future__ import annotations

import re
import unicodedata

_LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"}
_TOKEN = re.compile(r"\w+", re.UNICODE)


def normalize(text: str) -> str:
    for ligature, replacement in _LIGATURES.items():
        text = text.replace(ligature, replacement)
    text = unicodedata.normalize("NFC", text).casefold()
    return " ".join(_TOKEN.findall(text))


def quote_occurs(quote: str, source: str, min_token_ratio: float) -> bool:
    """Exact normalised substring, or (for quotes the model lightly reflowed) an in-order token match."""
    needle = normalize(quote)
    if not needle:
        return False
    haystack = normalize(source)
    # Pad with spaces so a quote only matches whole words ("Java" must not match "JavaScript").
    if f" {needle} " in f" {haystack} ":
        return True

    tokens = needle.split()
    if len(tokens) < 4:
        return False  # short quotes must match exactly
    source_tokens = haystack.split()
    position = 0
    found = 0
    for token in tokens:
        try:
            position = source_tokens.index(token, position) + 1
            found += 1
        except ValueError:
            continue
    return found / len(tokens) >= min_token_ratio


def split_quotes(quotes: list[str], source: str, min_token_ratio: float) -> tuple[list[str], list[str]]:
    verified, unverified = [], []
    for quote in quotes:
        (verified if quote_occurs(quote, source, min_token_ratio) else unverified).append(quote)
    return verified, unverified
