"""
utils.py — Sample utility functions for the CodeCheck Python example.

These functions cover a range of patterns that CodeCheck can test:
  - Pure transformations (add, subtract, multiply, safe_divide)
  - String manipulation (capitalize_words, truncate, slugify, count_vowels)
  - List processing (flatten, unique, chunk, moving_average)
  - Data validation (is_valid_email, is_palindrome, clamp)
  - Dictionary operations (merge_dicts, invert_dict, pick_keys)
"""

from __future__ import annotations
from typing import Any


# ─── Arithmetic ───────────────────────────────────────────────────────────────

def add(a: float, b: float) -> float:
    """Return the sum of a and b."""
    return a + b


def subtract(a: float, b: float) -> float:
    """Return a minus b."""
    return a - b


def multiply(a: float, b: float) -> float:
    """Return a multiplied by b."""
    return a * b


def safe_divide(a: float, b: float) -> float:
    """Return a / b, raising ValueError if b is zero."""
    if b == 0:
        raise ValueError("Division by zero is not allowed")
    return a / b


def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value to the range [min_val, max_val]."""
    return max(min_val, min(max_val, value))


# ─── String Operations ────────────────────────────────────────────────────────

def capitalize_words(text: str) -> str:
    """Capitalize the first letter of each word in text."""
    return " ".join(word.capitalize() for word in text.split())


def truncate(text: str, max_length: int, suffix: str = "...") -> str:
    """Truncate text to max_length, appending suffix if truncated."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug (lowercase, hyphens)."""
    import re
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def count_vowels(text: str) -> int:
    """Return the number of vowels (a, e, i, o, u) in text (case-insensitive)."""
    return sum(1 for ch in text.lower() if ch in "aeiou")


def is_palindrome(text: str) -> bool:
    """Return True if text is a palindrome (ignoring case and spaces)."""
    cleaned = "".join(ch.lower() for ch in text if ch.isalnum())
    return cleaned == cleaned[::-1]


# ─── List Processing ──────────────────────────────────────────────────────────

def flatten(nested: list[Any]) -> list[Any]:
    """Recursively flatten a nested list into a single flat list."""
    result: list[Any] = []
    for item in nested:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


def unique(items: list[Any]) -> list[Any]:
    """Return a list with duplicates removed, preserving insertion order."""
    seen: set[Any] = set()
    result: list[Any] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def chunk(items: list[Any], size: int) -> list[list[Any]]:
    """Split items into chunks of at most size elements."""
    if size <= 0:
        raise ValueError("Chunk size must be greater than zero")
    return [items[i : i + size] for i in range(0, len(items), size)]


def moving_average(values: list[float], window: int) -> list[float]:
    """Return a list of moving averages with the given window size."""
    if window <= 0:
        raise ValueError("Window size must be greater than zero")
    if window > len(values):
        return []
    return [
        sum(values[i : i + window]) / window
        for i in range(len(values) - window + 1)
    ]


# ─── Data Validation ──────────────────────────────────────────────────────────

def is_valid_email(email: str) -> bool:
    """Return True if email matches a basic valid email pattern."""
    import re
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


# ─── Dictionary Operations ────────────────────────────────────────────────────

def merge_dicts(*dicts: dict[str, Any]) -> dict[str, Any]:
    """Merge multiple dicts into one (later dicts win on key conflicts)."""
    result: dict[str, Any] = {}
    for d in dicts:
        result.update(d)
    return result


def invert_dict(d: dict[str, Any]) -> dict[Any, str]:
    """Swap keys and values. Raises ValueError if values are not unique."""
    if len(set(d.values())) != len(d):
        raise ValueError("Cannot invert dict with duplicate values")
    return {v: k for k, v in d.items()}


def pick_keys(d: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    """Return a new dict containing only the specified keys."""
    return {k: d[k] for k in keys if k in d}
