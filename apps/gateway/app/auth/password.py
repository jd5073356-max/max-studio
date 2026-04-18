"""Password hashing con bcrypt directo.

No usamos passlib porque passlib 1.7.4 es incompatible con bcrypt 5.x
(passlib intenta leer `bcrypt.__about__` que fue removido en bcrypt 4.1+).
"""

from __future__ import annotations

import bcrypt

# bcrypt tiene un límite duro de 72 bytes. Truncamos para evitar ValueError.
_MAX_BYTES = 72


def _encode(plain: str) -> bytes:
    return plain.encode("utf-8")[:_MAX_BYTES]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_encode(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))
    except ValueError:
        return False
