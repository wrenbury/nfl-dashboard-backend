# app/utils/cfb_logos.py

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional


def _data_csv_path() -> Path:
    """
    Resolve the cfb_espn_team_logos.csv path relative to this file.

    Layout:
        project_root/
            app/
                utils/
                    cfb_logos.py   <- this file
            data/
                cfb_espn_team_logos.csv
    """
    here = Path(__file__).resolve()
    project_root = here.parents[2]
    return project_root / "data" / "cfb_espn_team_logos.csv"


def _normalize_name(name: str) -> str:
    """
    Normalize various name forms (school, alt_name, abbreviation) into a
    simple lookup key: lowercase alnum only.

    Examples:
        "North Texas"         -> "northtexas"
        "UNLV"                -> "unlv"
        "James Madison Univ." -> "jamesmadisonuniv"
    """
    import re

    s = name.strip().lower()
    # Normalize common punctuation
    s = re.sub(r"[&+]", "and", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


@lru_cache(maxsize=1)
def _name_to_logo_map() -> Dict[str, str]:
    """
    Build a mapping of normalized team names/aliases to logo URLs.

    The CSV contains:
        id,school,mascot,abbreviation,alt_name1,alt_name2,alt_name3,...,logo,...

    We index by:
        - school
        - abbreviation
        - alt_name1/2/3
    """
    csv_path = _data_csv_path()
    mapping: Dict[str, str] = {}

    if not csv_path.exists():
        # In production this should exist; if it's missing we simply
        # don't add logos for CFB.
        return mapping

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            logo = row.get("logo") or ""
            if not logo:
                continue

            candidates = {
                row.get("school") or "",
                row.get("abbreviation") or "",
                row.get("alt_name1") or "",
                row.get("alt_name2") or "",
                row.get("alt_name3") or "",
            }
            for name in candidates:
                name = name.strip()
                if not name:
                    continue
                key = _normalize_name(name)
                # First match wins; don't overwrite existing mapping.
                mapping.setdefault(key, logo)

    return mapping


def get_cfb_logo(team_name: Optional[str]) -> Optional[str]:
    """
    Given a CFBD team name, return the best-guess ESPN logo URL.

    This only matches by name/aliases so it's safe even if CFBD's
    numeric IDs don't align with ESPN's.
    """
    if not team_name:
        return None

    key = _normalize_name(team_name)
    mapping = _name_to_logo_map()
    return mapping.get(key)
