"""Validate the EC2 subset before transfer and install it under the deploy lock."""

import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlsplit

DATABASE_KEYS = ("POSTGRES_PASSWORD", "API_DATABASE_PASSWORD")
DEMO_KEYS = ("DEMO_CITIZEN_A_PASSWORD", "DEMO_CITIZEN_B_PASSWORD", "DEMO_MANAGER_PASSWORD")
KEYS = (*DATABASE_KEYS, *DEMO_KEYS, "WEB_ORIGIN")


def validate(payload):
    if not isinstance(payload, dict) or set(payload) != set(KEYS):
        raise ValueError
    for key in KEYS:
        value = payload[key]
        if not isinstance(value, str) or not value.strip() or any(ord(c) < 32 for c in value):
            raise ValueError
    if not all(re.fullmatch(r"[A-Za-z0-9_-]+", payload[k]) for k in DATABASE_KEYS):
        raise ValueError
    if len({payload[k] for k in (*DATABASE_KEYS, *DEMO_KEYS)}) != 5:
        raise ValueError
    origin = urlsplit(payload["WEB_ORIGIN"])
    if origin.scheme != "https" or not origin.hostname or origin.username is not None or origin.path or origin.query or origin.fragment:
        raise ValueError
    # Accessing port also validates its range.
    _ = origin.port
    return payload


def compose_value(value):
    if re.fullmatch(r"[a-zA-Z0-9_./:-]+", value):
        return value
    return json.dumps(value.replace("$", "$$"), ensure_ascii=False)


def install(path, values):
    if path.is_symlink() or not path.is_file():
        raise ValueError
    lines = path.read_text().splitlines(keepends=True)
    kept = []
    current = {}
    for line in lines:
        match = re.match(r"^\s*(?:export\s+)?([A-Z_]+)\s*=(.*)", line)
        if match and match[1] in KEYS:
            if match[1] in current:
                raise ValueError
            current[match[1]] = match[2].strip()
        else:
            kept.append(line)
    # Updating POSTGRES_PASSWORD in the container does not change the password in a populated volume.
    if current.get("POSTGRES_PASSWORD", "").strip("'\x22") != values["POSTGRES_PASSWORD"]:
        raise ValueError
    original = "".join(lines)
    remaining = "".join(kept)
    if remaining and not remaining.endswith("\n"):
        remaining += "\n"
    updated = remaining + "".join(f"{k}={compose_value(values[k])}\n" for k in KEYS)
    if updated == original and path.stat().st_mode & 0o777 == 0o600:
        return
    fd, tmp = tempfile.mkstemp(prefix=".env.incoming-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["check"]:
            validate(json.load(sys.stdin))
        elif sys.argv[1:] == ["send"]:
            if sys.stdout.isatty():
                sys.exit("O envio da configuração exige um canal de entrada do deploy.")
            values = validate(json.loads(os.environ["EC2_RUNTIME_ENV"]))
            # The deploy process reads the registry token first and the environment from the rest of stdin.
            print(os.environ["GHCR_TOKEN"])
            print(json.dumps(values, ensure_ascii=False))
        elif len(sys.argv) == 3 and sys.argv[1] == "apply":
            install(Path(sys.argv[2]), validate(json.load(sys.stdin)))
        else:
            raise ValueError
    except (KeyError, ValueError, OSError):
        sys.exit("Configuração de implantação inválida. Confira os campos da EC2 e a senha do PostgreSQL existente.")
