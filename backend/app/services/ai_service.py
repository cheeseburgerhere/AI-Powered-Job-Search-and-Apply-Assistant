import json
import urllib.error
import urllib.request
from urllib.parse import quote

import anthropic

from app.config import get_settings


class AIService:
    """Provider-agnostic AI service for Anthropic, Gemini, and Qwen."""

    SUPPORTED_PROVIDERS = {"anthropic", "gemini", "qwen"}

    def __init__(self):
        self.settings = get_settings()
        self.provider = (self.settings.ai_provider or "anthropic").strip().lower()
        if self.provider not in self.SUPPORTED_PROVIDERS:
            supported = ", ".join(sorted(self.SUPPORTED_PROVIDERS))
            raise ValueError(f"Unsupported AI_PROVIDER '{self.provider}'. Supported values: {supported}")

        self.client = None
        if self.provider == "anthropic" and self.settings.anthropic_api_key:
            self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

    def _default_model(self, speed: str = "general") -> str:
        # Optional env overrides always win.
        if speed == "fast" and self.settings.ai_model_fast:
            return self.settings.ai_model_fast
        if speed == "general" and self.settings.ai_model_general:
            return self.settings.ai_model_general

        if self.provider == "anthropic":
            return "claude-haiku-4-20250414" if speed == "fast" else "claude-sonnet-4-20250514"
        if self.provider == "gemini":
            # Gemini Flash is suitable for quick/cheap testing.
            return "gemini-2.0-flash"
        # Qwen defaults requested by user: max for quality, plus for speed/cost.
        return "qwen-plus" if speed == "fast" else "qwen-max"

    def _post_json(self, url: str, headers: dict[str, str], payload: dict) -> dict:
        request = urllib.request.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"{self.provider} API error {exc.code}: {details[:500]}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"{self.provider} API request failed: {exc.reason}") from exc

    def _call_anthropic(self, system: str, user: str, model: str, max_tokens: int) -> str:
        if not self.client:
            if not self.settings.anthropic_api_key:
                raise RuntimeError("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic")
            self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

        message = self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )

        parts = []
        for block in message.content:
            text = getattr(block, "text", "")
            if text:
                parts.append(text)
        return "\n".join(parts).strip()

    def _call_gemini(self, system: str, user: str, model: str, max_tokens: int) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")

        model_name = quote(model, safe="")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
            f"?key={self.settings.gemini_api_key}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_tokens},
        }
        response = self._post_json(url, {"Content-Type": "application/json"}, payload)

        candidates = response.get("candidates") or []
        if not candidates:
            raise RuntimeError(f"Gemini returned no candidates: {json.dumps(response)[:500]}")

        parts = (candidates[0].get("content") or {}).get("parts") or []
        texts = [part.get("text", "") for part in parts if part.get("text")]
        if not texts:
            raise RuntimeError(f"Gemini returned empty text: {json.dumps(response)[:500]}")
        return "\n".join(texts).strip()

    def _call_qwen(self, system: str, user: str, model: str, max_tokens: int) -> str:
        if not self.settings.qwen_api_key:
            raise RuntimeError("QWEN_API_KEY is required when AI_PROVIDER=qwen")

        base = self.settings.qwen_api_base.rstrip("/")
        url = f"{base}/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.settings.qwen_api_key}",
            "Content-Type": "application/json",
        }
        response = self._post_json(url, headers, payload)

        choices = response.get("choices") or []
        if not choices:
            raise RuntimeError(f"Qwen returned no choices: {json.dumps(response)[:500]}")

        content = (choices[0].get("message") or {}).get("content", "")
        if isinstance(content, list):
            chunks = []
            for item in content:
                if isinstance(item, str):
                    chunks.append(item)
                elif isinstance(item, dict) and item.get("text"):
                    chunks.append(item["text"])
            content = "\n".join(chunks)

        content = str(content).strip()
        if not content:
            raise RuntimeError(f"Qwen returned empty text: {json.dumps(response)[:500]}")
        return content

    def _call(
        self,
        system: str,
        user: str,
        model: str | None = None,
        max_tokens: int = 4096,
        speed: str = "general",
    ) -> str:
        target_model = model or self._default_model(speed=speed)

        if self.provider == "anthropic":
            return self._call_anthropic(system, user, target_model, max_tokens)
        if self.provider == "gemini":
            return self._call_gemini(system, user, target_model, max_tokens)
        return self._call_qwen(system, user, target_model, max_tokens)

    def _extract_json_text(self, raw_text: str) -> str:
        text = raw_text.strip()

        # Strip fenced code blocks if present.
        if text.startswith("```"):
            lines = text.splitlines()
            if lines:
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        # If model wrapped JSON in prose, pull the outermost object.
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = text[start : end + 1]
            try:
                json.loads(candidate)
                return candidate
            except json.JSONDecodeError:
                pass

        return text

    def parse_resume(self, resume_text: str) -> dict:
        from app.prompts.resume_parse import RESUME_PARSE_SYSTEM

        response = self._call(RESUME_PARSE_SYSTEM, resume_text, speed="general")
        return json.loads(self._extract_json_text(response))

    def analyze_voice(self, writing_samples: list[str]) -> str:
        from app.prompts.voice_analysis import VOICE_ANALYSIS_SYSTEM

        combined = "\n\n---\n\n".join(writing_samples)
        return self._call(VOICE_ANALYSIS_SYSTEM, combined, speed="general")

    def score_fit(self, profile_text: str, jd_text: str) -> dict:
        from app.prompts.fit_score import FIT_SCORE_SYSTEM, build_fit_score_prompt

        response = self._call(
            FIT_SCORE_SYSTEM,
            build_fit_score_prompt(profile_text, jd_text),
            speed="fast",
        )
        return json.loads(self._extract_json_text(response))

    def generate_cover_letter(
        self,
        profile_text: str,
        voice_profile: str,
        jd_text: str,
        company: str,
        title: str,
    ) -> str:
        from app.prompts.cover_letter import build_cover_letter_prompt

        system, user = build_cover_letter_prompt(profile_text, voice_profile, jd_text, company, title)
        return self._call(system, user, speed="general")

    def refine_cover_letter(self, current_letter: str, feedback: str) -> str:
        from app.prompts.cover_letter import REFINE_SYSTEM, build_refine_prompt

        return self._call(REFINE_SYSTEM, build_refine_prompt(current_letter, feedback), speed="general")


# Singleton
_ai_service = None


def get_ai_service() -> AIService:
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
