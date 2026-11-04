"""Turn a browser's User-Agent string into something people recognise, like "Chrome on Windows".

This is a best-effort label for the sessions list, not a security check: User-Agent strings are
easy to fake.
"""

import re

# Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
_BROWSERS = [
    (r"Edg(e|A|iOS)?/", "Edge"),
    (r"OPR/|Opera", "Opera"),
    (r"Firefox/|FxiOS/", "Firefox"),
    (r"Chrome/|CriOS/", "Chrome"),
    (r"Safari/", "Safari"),
]

_SYSTEMS = [
    (r"iPhone", "iPhone"),
    (r"iPad", "iPad"),
    (r"Android", "Android"),
    (r"Windows", "Windows"),
    (r"Mac OS X|Macintosh", "Mac"),
    (r"CrOS", "ChromeOS"),
    (r"Linux", "Linux"),
]


def _first_match(patterns: list[tuple[str, str]], text: str) -> str | None:
    for pattern, label in patterns:
        if re.search(pattern, text):
            return label
    return None


def describe_user_agent(user_agent: str | None) -> str:
    ua = user_agent or ""
    browser = _first_match(_BROWSERS, ua)
    system = _first_match(_SYSTEMS, ua)
    if browser and system:
        return f"{browser} on {system}"
    if browser or system:
        return browser or system
    return "Unknown device"
