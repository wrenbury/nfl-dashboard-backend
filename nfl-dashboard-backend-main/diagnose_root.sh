#!/usr/bin/env bash
set -euo pipefail
echo "== Repo root: $(pwd)"
echo "== Layout (depth 3) =="
( command -v tree >/dev/null 2>&1 && tree -L 3 || find . -maxdepth 3 -type d -o -type f | sed 's|^\./||' | sort ) | sed -n '1,300p'
echo

echo "== Tests dirs =="
find . -type d -name tests -maxdepth 3 -print
echo

echo "== pyproject.toml (root) =="
sed -n '1,140p' pyproject.toml
echo

echo "== Import sanity (root .) =="
python - <<'PY'
import sys, os, inspect
print("CWD:", os.getcwd())
print("sys.path[:5]:", sys.path[:5])
try:
    import app
    print("app imported from:", inspect.getfile(app))
except Exception as e:
    print("!! import app failed:", repr(e))
PY
echo

echo "== pip show football-dashboard =="
python -m pip show football-dashboard || echo "(not installed)"
echo

echo "== Pytest collect =="
pytest --collect-only -q || true
