"""AES-256-GCM authenticated encryption for secret fields at rest."""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key() -> bytes:
    raw = os.environ["ENCRYPTION_KEY"]
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError("ENCRYPTION_KEY must be base64-encoded 32 bytes (AES-256)")
    return key


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a string with AES-256-GCM. Returns base64(nonce(12) || ciphertext+tag)."""
    if plaintext is None:
        return ""
    aesgcm = AESGCM(_key())
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("utf-8")


def decrypt_secret(token: str) -> str:
    if not token:
        return ""
    raw = base64.b64decode(token)
    nonce, ct = raw[:12], raw[12:]
    aesgcm = AESGCM(_key())
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")


def mask_secret(_token: str) -> str:
    """Return a placeholder for hidden secrets in API responses."""
    return "••••••••"
