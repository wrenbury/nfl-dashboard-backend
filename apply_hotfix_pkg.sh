#!/usr/bin/env bash
set -euo pipefail

cd backend

# 1) ensure packages are real Python packages
touch app/__init__.py
mkdir -p app/{api,clients,models,services,utils}
touch app/api/__init__.py
touch app/clients/__init__.py
touch app/models/__init__.py
touch app/services/__init__.py
touch app/utils/__init__.py

# 2) robust pyproject for editable install
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
testpaths = ["backend/tests"]
TOML

# 3) pytest config (keep quiet output)
cat > pytest.ini <<'INI'
[pytest]
addopts = -q
INI

echo "Hotfix applied."
