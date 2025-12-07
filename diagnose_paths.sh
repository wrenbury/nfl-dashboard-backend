#!/usr/bin/env bash
set -euo pipefail

echo "== Repo root: $(pwd)"
echo

echo "== Top-level layout (depth 3) =="
( command -v tree >/dev/null 2>&1 && tree -L 3 || find . -maxdepth 3 -type d -o -type f | sed 's|^\./||' | sort ) | sed -n '1,300p'
echo

echo "== Detected test directories =="
find . -type d -name tests -maxdepth 3 -print
echo

echo "== Pyproject files =="
find . -name pyproject.toml -maxdepth 3 -print -exec sh -c 'echo "---"; sed -n "1,120p" "$1"' _ {} \;
echo

echo "== Backend/app package sanity =="
if [ -d backend/app ]; then
  echo "backend/app exists"
  find backend/app -maxdepth 2 -type f -name "__init__.py" -print || true
else
  echo "!! Missing backend/app directory"
fi
echo

echo "== Python import sanity (tries to import app) =="
( cd backend 2>/dev/null && python3 - <<'PY' || true
import sys, os, inspect
print("CWD:", os.getcwd())
print("sys.path[:5]:", sys.path[:5])
try:
    import app
    print("app imported from:", inspect.getfile(app))
except Exception as e:
    print("!! import app failed:", repr(e))
PY
)
echo

echo "== pip show football-dashboard (if installed) =="
( cd backend 2>/dev/null && python3 -m pip show football-dashboard || echo "(not installed)" )
echo

echo "== Pytest collection (backend only) =="
( cd backend 2>/dev/null && pytest --collect-only -q || true )
echo

echo "== Stray macOS files & bytecode caches =="
find . -name ".DS_Store" -print
find . -name "__pycache__" -type d -print | sed -n '1,50p'
echo

cat <<'TXT'

If you see:
- "!! import app failed": your package or install is off. Ensure:
    backend/app/__init__.py exists
    backend/pyproject.toml declares packages=["app"] with setuptools
    pip install -e ./backend
- Multiple tests folders listed: run pytest with explicit path:
    pytest -q backend/tests
  or merge other tests into backend/tests
- More than one pyproject.toml near backend: keep only backend/pyproject.toml for the backend package

Next, run:
  cd backend
  python -m venv .venv && source .venv/bin/activate
  pip install -e ".[dev]"
  pytest -q backend/tests  # scope to new tests first
TXT
