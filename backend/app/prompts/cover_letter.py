COVER_LETTER_SYSTEM = """Write a cover letter for this candidate applying to this role.

Rules:
- Match the candidate's writing voice described below
- Address specific requirements from the JD
- Map candidate's experiences to the role's needs with concrete examples
- Keep it under 400 words
- Don't be generic — reference the company and role specifically
- Sound human, not like AI wrote it
- Don't start with "I am writing to express my interest" or similar clichés
- Use a natural opening that shows genuine interest in the specific role"""


def build_cover_letter_prompt(
    profile_text: str,
    voice_profile: str,
    jd_text: str,
    company: str,
    title: str,
) -> tuple[str, str]:
    system = COVER_LETTER_SYSTEM + f"\n\nCANDIDATE'S WRITING VOICE:\n{voice_profile}" if voice_profile else COVER_LETTER_SYSTEM
    user = f"""CANDIDATE PROFILE:
{profile_text}

JOB DESCRIPTION:
{jd_text}

COMPANY: {company}
ROLE: {title}"""
    return system, user


REFINE_SYSTEM = """Refine this cover letter based on the user's feedback.
Maintain the same voice and structure unless told otherwise.
Only change what the feedback asks for. Return the full revised letter."""


def build_refine_prompt(current_letter: str, feedback: str) -> str:
    return f"""CURRENT LETTER:
{current_letter}

FEEDBACK:
{feedback}"""
