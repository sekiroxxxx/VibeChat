"""
Prompt Accuracy Test Suite
==========================
Runs prompt-fixtures.json against the real LLM and asserts expected behavior.

Covers:
  - Schema compliance (parseError, required fields, vector dimensions)
  - Content quality (emotion classification, safety detection, authenticity)
  - Opening message rules (length, no-speaking-for-users, personalization)

Usage:
  cd <project_root>
  python server/tests/test_prompt_accuracy.py

Requires: server running (for .env loading) OR .env in server/ directory.
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

# -- Path setup --
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(SERVER_DIR / ".env")

from server.config import config
from server.lib.llm_provider import LLMConfig, create_llm_provider
from server.lib.schema_validator import parse_llm_output

FIXTURES_PATH = SERVER_DIR / "prompts" / "prompt-fixtures.json"

# -- Output helpers --
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"


def safe_str(s: str, max_len: int = 80) -> str:
    """Encode string safely for GBK terminals, truncate if needed."""
    truncated = s[:max_len] + "..." if len(s) > max_len else s
    return truncated.encode("ascii", errors="replace").decode("ascii")


def load_fixtures():
    with open(FIXTURES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
#  Emotion Analysis Assertions
# ============================================================

def assert_emotion_schema(result: dict) -> list[str]:
    """Check JSON schema compliance. Returns list of failure messages."""
    failures = []

    if result.get("parseError"):
        failures.append(f"parseError=true: {result.get('error', '?')}")
        return failures

    data = result.get("data", result)

    # Required top-level fields
    required = [
        "primary_emotion", "secondary_emotion", "intensity", "valence",
        "emotion_vector", "interpretation", "keywords", "match_preferences",
        "safety", "authenticity"
    ]
    for field in required:
        if field not in data:
            failures.append(f"missing required field: {field}")

    # intensity range
    if "intensity" in data:
        if not (0 <= data["intensity"] <= 1):
            failures.append(f"intensity out of range: {data['intensity']}")

    # valence range
    if "valence" in data:
        if not (-1 <= data["valence"] <= 1):
            failures.append(f"valence out of range: {data['valence']}")

    # emotion_vector: 12 Chinese dimensions, values 0-1
    if "emotion_vector" in data:
        vec = data["emotion_vector"]
        expected_dims = {"喜悦", "悲伤", "焦虑", "愤怒", "孤独", "期待",
                         "平静", "疲惫", "恐惧", "感激", "困惑", "释然"}
        actual_dims = set(vec.keys())
        if actual_dims != expected_dims:
            missing = expected_dims - actual_dims
            extra = actual_dims - expected_dims
            if missing:
                failures.append(f"vector missing dims: {missing}")
            if extra:
                failures.append(f"vector extra dims: {extra}")
        for k, v in vec.items():
            if not (0 <= v <= 1):
                failures.append(f"vector[{k}] out of range: {v}")

    # interpretation length: 20-70 chars
    if "interpretation" in data:
        interp = data["interpretation"]
        if len(interp) < 15:
            failures.append(f"interpretation too short ({len(interp)} chars): {interp}")
        if len(interp) > 80:
            failures.append(f"interpretation too long ({len(interp)} chars)")

    # keywords list
    if "keywords" in data:
        if not isinstance(data["keywords"], list) or len(data["keywords"]) < 1:
            failures.append(f"keywords empty or not a list: {data['keywords']}")

    # match_preferences structure
    if "match_preferences" in data:
        mp = data["match_preferences"]
        if "recommended" not in mp:
            failures.append("match_preferences missing recommended")
        elif not isinstance(mp["recommended"], list) or len(mp["recommended"]) < 1:
            failures.append("match_preferences.recommended empty")

    # safety structure
    if "safety" in data:
        s = data["safety"]
        for f in ["risk_level", "risk_type", "suitable_for_chat", "action"]:
            if f not in s:
                failures.append(f"safety missing: {f}")
        if s.get("risk_level") not in ("NONE", "MEDIUM", "HIGH"):
            failures.append(f"safety.risk_level invalid: {s.get('risk_level')}")

    # authenticity structure
    if "authenticity" in data:
        a = data["authenticity"]
        for f in ["is_genuine_emotion", "flags", "confidence"]:
            if f not in a:
                failures.append(f"authenticity missing: {f}")

    return failures


def assert_emotion_fixture(data: dict, fixture: dict) -> list[str]:
    """Check fixture-specific expectations. Returns list of failure messages."""
    failures = []

    if "expected_primary" in fixture:
        actual = data.get("primary_emotion", "")
        expected = fixture["expected_primary"]
        if actual != expected:
            failures.append(
                f"primary_emotion: expected={expected}, got={actual}"
            )

    if "expected_risk" in fixture:
        actual = data.get("safety", {}).get("risk_level", "")
        expected = fixture["expected_risk"]
        if actual != expected:
            failures.append(
                f"risk_level: expected={expected}, got={actual}"
            )

    if "expected_suitable_for_chat" in fixture:
        actual = data.get("safety", {}).get("suitable_for_chat", None)
        expected = fixture["expected_suitable_for_chat"]
        if actual is not expected:
            failures.append(
                f"suitable_for_chat: expected={expected}, got={actual}"
            )

    if "expected_valence_positive" in fixture:
        valence = data.get("valence", 0)
        is_positive = valence > 0
        if is_positive != fixture["expected_valence_positive"]:
            failures.append(
                f"valence direction wrong: {valence} "
                f"(expected {'positive' if fixture['expected_valence_positive'] else 'negative'})"
            )

    if "expected_secondary_not_null" in fixture:
        if fixture["expected_secondary_not_null"]:
            if data.get("secondary_emotion") is None:
                failures.append("secondary_emotion is null, expected non-null")

    if "expected_genuine" in fixture:
        actual = data.get("authenticity", {}).get("is_genuine_emotion", None)
        expected = fixture["expected_genuine"]
        if actual is not expected:
            failures.append(
                f"is_genuine_emotion: expected={expected}, got={actual}"
            )

    if "expected_confidence_below" in fixture:
        actual = data.get("authenticity", {}).get("confidence", 1.0)
        threshold = fixture["expected_confidence_below"]
        if actual >= threshold:
            failures.append(
                f"confidence too high for vague input: {actual} >= {threshold}"
            )

    return failures


# ============================================================
#  Opening Message Assertions
# ============================================================

def assert_opening_schema(result: dict) -> list[str]:
    """Check opening message JSON structure."""
    failures = []

    if result.get("parseError"):
        failures.append(f"parseError=true: {result.get('error', '?')}")
        return failures

    data = result.get("data", result)

    for field in ["opening_message", "for_user_a", "for_user_b"]:
        if field not in data:
            failures.append(f"missing required field: {field}")

    if "opening_message" in data:
        msg = data["opening_message"]
        if not msg or not isinstance(msg, str):
            failures.append(f"opening_message empty or not string")
        elif len(msg.strip()) < 5:
            failures.append(f"opening_message too short: {msg}")

    return failures


def assert_opening_fixture(data: dict, fixture: dict) -> list[str]:
    """Check fixture-specific opening expectations."""
    failures = []

    opening = data.get("opening_message", "")

    if "max_length" in fixture:
        if len(opening) > fixture["max_length"]:
            failures.append(
                f"opening_message too long: {len(opening)} chars (max {fixture['max_length']})"
            )

    if "must_not_contain" in fixture:
        for phrase in fixture["must_not_contain"]:
            if phrase in opening:
                failures.append(
                    f"opening_message contains forbidden phrase: '{phrase}'"
                )

    # for_user_a should differ from for_user_b (personalization)
    ua = data.get("for_user_a", "")
    ub = data.get("for_user_b", "")
    if ua and ub and ua == ub:
        failures.append("for_user_a == for_user_b (not personalized)")

    return failures


# ============================================================
#  Test Runner
# ============================================================

class PromptTestRunner:
    def __init__(self):
        self.results: list[dict] = []
        self.passed = 0
        self.failed = 0

    def record(self, label: str, test_type: str, failures: list[str],
               raw: str = "", parsed: dict | None = None, duration_ms: int = 0):
        status = "PASS" if not failures else "FAIL"
        if status == "PASS":
            self.passed += 1
        else:
            self.failed += 1

        entry = {
            "label": label,
            "type": test_type,
            "status": status,
            "failures": failures,
            "duration_ms": duration_ms,
        }
        self.results.append(entry)

        icon = f"{GREEN}[OK]{RESET}" if status == "PASS" else f"{RED}[FAIL]{RESET}"
        print(f"  {icon} {label}")
        for f_msg in failures:
            print(f"      {RED}-> {f_msg}{RESET}")

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{CYAN}{'=' * 55}{RESET}")
        print(f"  {BOLD}Prompt Accuracy: {self.passed}/{total} passed{RESET}")
        if self.failed > 0:
            print(f"  {RED}{self.failed} failures — review above{RESET}")
        else:
            print(f"  {GREEN}All prompts behaving as expected{RESET}")
        print(f"{CYAN}{'=' * 55}{RESET}\n")
        return self.failed == 0


async def run_emotion_tests(provider, fixtures, runner):
    print(f"\n{CYAN}[ Emotion Analysis Prompt ]{RESET}")

    for i, fx in enumerate(fixtures):
        label = f"E{i+1:02d} {fx['label']}"
        t0 = time.time()

        try:
            raw = await provider.analyze_emotion(fx["input"])
        except Exception as e:
            runner.record(label, "emotion", [f"LLM call failed: {e}"])
            continue

        duration_ms = int((time.time() - t0) * 1000)

        # Layer 1: Schema compliance
        parsed = parse_llm_output(raw)
        schema_failures = assert_emotion_schema(parsed)

        # Layer 2: Fixture-specific assertions
        data = parsed.get("data", {}) if not parsed.get("parseError") else {}
        fixture_failures = assert_emotion_fixture(data, fx) if not parsed.get("parseError") else []

        all_failures = schema_failures + fixture_failures
        runner.record(label, "emotion", all_failures, raw=raw, duration_ms=duration_ms)

        # Verbose: show primary emotion for all
        if not all_failures:
            emo = safe_str(str(data.get('primary_emotion', '?')), 20)
            risk = safe_str(str(data.get('safety', {}).get('risk_level', '?')), 10)
            print(f"      primary={emo} risk={risk} ({duration_ms}ms)")


async def run_opening_tests(provider, fixtures, runner):
    print(f"\n{CYAN}[ Opening Message Prompt ]{RESET}")

    for i, fx in enumerate(fixtures):
        label = f"O{i+1:02d} {fx['label']}"
        t0 = time.time()

        ctx = fx["shared_context"]
        ea = fx["emotion_a"]
        eb = fx["emotion_b"]

        try:
            result = await provider.generate_opening_message(ea, eb, ctx)
        except Exception as e:
            runner.record(label, "opening", [f"LLM call failed: {e}"])
            continue

        duration_ms = int((time.time() - t0) * 1000)

        # Layer 1: Schema
        # generate_opening_message already returns parsed JSON (or fallback dict)
        # Wrap in parse_llm_output format for consistency
        if isinstance(result, dict) and "opening_message" in result:
            wrapped = {"parseError": False, "data": result}
        else:
            wrapped = parse_llm_output(str(result))

        schema_failures = assert_opening_schema(wrapped)

        # Layer 2: Fixture assertions
        data = wrapped.get("data", {})
        fixture_failures = assert_opening_fixture(data, fx)

        all_failures = schema_failures + fixture_failures
        runner.record(label, "opening", all_failures, duration_ms=duration_ms)

        if not all_failures:
            msg = data.get("opening_message", "?")
            ua = data.get("for_user_a", "?")
            ub = data.get("for_user_b", "?")
            print(f"      [{len(msg)} chars] {safe_str(msg, 60)}")
            print(f"      A: {safe_str(ua, 50)}")
            print(f"      B: {safe_str(ub, 50)}")


async def main():
    print(f"{CYAN}{BOLD}\n+=======================================================+")
    print(f"|     VibeChat Prompt Accuracy Test Suite                |")
    print(f"+=======================================================+{RESET}\n")

    # 0. Load fixtures
    fixtures = load_fixtures()
    emotion_fixtures = fixtures.get("emotion", [])
    opening_fixtures = fixtures.get("opening", [])
    print(f"  Loaded {len(emotion_fixtures)} emotion + {len(opening_fixtures)} opening fixtures\n")

    # 1. Create LLM provider
    llm_config = LLMConfig(
        provider=config.LLM_PROVIDER,
        api_key=config.OPENAI_API_KEY if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_API_KEY,
        model=config.OPENAI_MODEL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_MODEL,
        base_url=config.OPENAI_BASE_URL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_BASE_URL,
    )
    provider = create_llm_provider(llm_config)
    print(f"  LLM: {llm_config.provider} / {llm_config.model}\n")

    runner = PromptTestRunner()

    # 2. Run emotion tests
    await run_emotion_tests(provider, emotion_fixtures, runner)

    # 3. Run opening tests
    await run_opening_tests(provider, opening_fixtures, runner)

    # 4. Summary
    all_ok = runner.summary()

    # 5. Detailed breakdown
    emotion_results = [r for r in runner.results if r["type"] == "emotion"]
    opening_results = [r for r in runner.results if r["type"] == "opening"]
    e_pass = sum(1 for r in emotion_results if r["status"] == "PASS")
    o_pass = sum(1 for r in opening_results if r["status"] == "PASS")
    print(f"  Emotion:  {e_pass}/{len(emotion_results)} passed")
    print(f"  Opening:  {o_pass}/{len(opening_results)} passed")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
