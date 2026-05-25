import html


def sanitize_text(text: str) -> str:
    return html.escape(text, quote=True)


def sanitize_missions(missions: list[dict]) -> list[dict]:
    sanitized = []
    for m in missions:
        sanitized.append(
            {
                **m,
                "title": sanitize_text(m.get("title", "")),
                "description": sanitize_text(m.get("description", "")),
            }
        )
    return sanitized
