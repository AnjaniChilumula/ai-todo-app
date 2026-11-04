"""Password hashing with Argon2 (via pwdlib). Plain-text passwords are never stored or logged."""

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()

# Checked when the email has no account, so a wrong email takes as long as a wrong password and
# response times don't reveal which emails are registered.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> tuple[bool, str | None]:
    """Check a password. Returns (ok, new_hash), where new_hash is set when the stored hash uses
    outdated settings and should be replaced."""
    if password_hash is None:
        _hasher.verify(password, _DUMMY_HASH)
        return False, None
    return _hasher.verify_and_update(password, password_hash)


def password_problem(password: str, email: str) -> str | None:
    """Rules beyond length (8-128, checked by the request model). Returns a message or None."""
    if password.strip().lower() == email.strip().lower():
        return "Your password can't be the same as your email."
    return None
