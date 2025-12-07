#!/usr/bin/env bash
set -euo pipefail

echo "[1/5] Ensure package structure under ./app"
mkdir -p app/{api,clients,models,services,utils}
touch app/__init__.py app/api/__init__.py app/clients/__init__.py app/models/__init__.py app/services/__init__.py app/utils/__init__.py

echo "[2/5] Write/repair pyproject.toml at repo root (setuptools + packages=['app'])"
cat > pyproject.toml <<'TOML'
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "football-dashboard"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
  "fastapi>=0.100,<1.0",
  "uvicorn[standard]>=0.22",
  "httpx>=0.24",
  "pydantic>=2.5",
]

[project.optional-dependencies]
dev = ["pytest>=8.0","pytest-asyncio>=0.23","pytest-mock>=3.12.0","respx>=0.21.1"]

[tool.setuptools]
packages = ["app"]
package-dir = {"" = "."}

[tool.pytest.ini_options]
testpaths = ["tests"]
TOML

echo "[3/5] Ensure pytest.ini (quiet output)"
printf "[pytest]\naddopts = -q\n" > pytest.ini

echo "[4/5] Clean .DS_Store and __pycache__"
find . -name ".DS_Store" -delete || true
find . -name "__pycache__" -type d -exec rm -rf {} + || true

echo "[5/5] Editable install + test collection"
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest --collect-only -q || true

echo "Hotfix complete. To run tests: source .venv/bin/activate && pytest -q"
