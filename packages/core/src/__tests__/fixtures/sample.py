"""
sample.py — Python fixture file for extractor tests.
Contains various function patterns that the Python extractor must handle.
"""

# 1. Simple function with type hints
def add(a: int, b: int) -> int:
    return a + b


# 2. Async function
async def fetch_user(user_id: str) -> dict:
    return {"name": "Alice", "email": "alice@example.com"}


# 3. Function with default parameter
def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}!"


# 4. Function with multiple return types (Union)
def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Division by zero")
    return a / b


# 5. Function with no type hints
def legacy_add(a, b):
    return a + b


# 6. Function with *args
def sum_all(*args: int) -> int:
    return sum(args)


# 7. Class with methods
class Calculator:
    def __init__(self) -> None:
        self.history: list[int] = []

    def add(self, a: int, b: int) -> int:
        result = a + b
        self.history.append(result)
        return result

    def get_history(self) -> list[int]:
        return list(self.history)


# 8. Private-by-convention function (still extracted — Python has no true private)
def _internal_helper(x: int) -> int:
    return x * 2
