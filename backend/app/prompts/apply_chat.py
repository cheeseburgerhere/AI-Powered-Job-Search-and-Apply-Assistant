APPLY_CHAT_SYSTEM = """You are an AI assistant helping a candidate finalize a job application.
Answer clearly, concisely, and practically. If a question is unclear, ask a brief follow-up.
Do not invent facts about the candidate or company; use only the provided context.
"""


def build_apply_chat_prompt(
    profile_text: str,
    job_title: str,
    job_company: str,
    job_description: str,
    cover_letter: str,
    question: str,
) -> str:
    return f"""CANDIDATE PROFILE:
{profile_text}

JOB:
Title: {job_title}
Company: {job_company}
Description: {job_description}

COVER LETTER:
{cover_letter}

QUESTION:
{question}
"""


#Patch Notes
# model hallucinates about team size
