#!/usr/bin/env python3
"""Refresh the checked-in catalogue from Coasterpedia park pages."""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://coasterpedia.net/w/api.php"
PARKS = [
    ("alton-towers", "Alton Towers", "Alton Towers"),
    ("thorpe-park", "Thorpe Park", "Thorpe Park"),
    ("chessington", "Chessington World of Adventures", "Chessington World of Adventures"),
    ("blackpool", "Blackpool Pleasure Beach", "Pleasure Beach Resort"),
    ("elitch-gardens", "Elitch Gardens", "Elitch Gardens (1995)"),
    ("magic-kingdom", "Magic Kingdom", "Magic Kingdom"),
    ("epcot", "Epcot", "Epcot"),
    ("animal-kingdom", "Animal Kingdom", "Disney's Animal Kingdom"),
    ("hollywood-studios", "Hollywood Studios", "Disney's Hollywood Studios"),
    ("disneyland-paris", "Disneyland Park (Paris)", "Disneyland Park (France)"),
    ("adventure-world-paris", "Disney Adventure World (Paris)", "Disney Adventure World"),
]
COASTERPEDIA_TYPES = {
    "Hybrid", "Steel", "Wooden", "Kiddie", "Hyper", "Giga", "Strata", "Exa",
    "4th Dimension", "Bobsled", "Floorless", "Flying", "Inverted", "Motorbike",
    "Steeplechase", "Pipeline", "Side Friction", "Spinning", "Virginia Reel",
    "Stand-Up", "Suspended", "Winged", "Cyclone", "Figure 8", "Out and Back",
    "U-shuttle", "Wacky Worm", "Wild Mouse", "Diving", "Water", "Enclosed",
    "Indoor", "Terrain", "Travelling", "Multi-tracked", "Möbius", "Single rail",
}


def api_query(**params: str) -> dict:
    query = urllib.parse.urlencode({"format": "json", **params})
    request = urllib.request.Request(
        f"{API}?{query}",
        headers={"User-Agent": "ThemeParkLogbook/1.0 (catalogue refresh)"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def fetch_wikitext(titles: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for offset in range(0, len(titles), 40):
        response = api_query(
            action="query",
            prop="revisions",
            rvprop="content",
            rvslots="main",
            redirects="1",
            titles="|".join(titles[offset : offset + 40]),
        )
        for page in response["query"]["pages"].values():
            if "revisions" in page:
                result[page["title"]] = page["revisions"][0]["slots"]["main"]["*"]
    return result


def plain(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"\{\{(?:[^{}]|\{\{[^{}]*\}\})*\}\}", "", value)
    value = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(re.sub(r"\s+", " ", value)).strip(" .")


def parse_present_tables(wikitext: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    headings: dict[int, str] = {}
    events = re.compile(
        r"^(?P<marks>={2,5})\s*(?P<title>.*?)\s*(?P=marks)\s*$|(?P<table>^\{\|.*?^\|\})",
        re.M | re.S,
    )

    for event in events.finditer(wikitext):
        if event.group("title") is not None:
            level = len(event.group("marks"))
            headings[level] = plain(event.group("title"))
            headings = {key: value for key, value in headings.items() if key <= level}
            continue

        path = " / ".join(headings[key] for key in sorted(headings)).lower()
        if not any(term in path for term in ("present", "operating")):
            continue
        if any(term in path for term in ("upcoming", "past", "closed", "defunct", "former", "storage", "refurbishment", "standing but not operating")):
            continue

        table = event.group("table")
        if table is None:
            continue
        headers: list[str] = []
        for line in table.splitlines():
            if line.startswith("!"):
                headers.extend(plain(cell) for cell in line[1:].split("!!"))
        if "Name" not in headers or "Type" not in headers:
            continue

        for raw_row in re.split(r"^\|-.*$", table, flags=re.M)[1:]:
            raw_cells: list[str] = []
            for line in raw_row.splitlines():
                if line.startswith("|") and not line.startswith(("|-", "|}")):
                    raw_cells.extend(cell.strip() for cell in line[1:].split("||"))
            if len(raw_cells) < len(headers):
                continue
            values = dict(zip(headers, (plain(cell) for cell in raw_cells)))
            name_cell = raw_cells[headers.index("Name")]
            link = re.search(r"\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]", name_cell)
            values["_page"] = link.group(1).strip() if link else values["Name"]
            values["_coaster"] = "coaster" in path or bool(values.get("Class"))
            rows.append(values)
    return rows


def category_for(ride_type: str, name: str) -> str:
    value = f"{ride_type} {name}".lower()
    if any(term in value for term in ("dark ride", "madhouse", "haunted", "ghost train")):
        return "Dark Ride"
    if any(term in value for term in ("water", "boat", "flume", "rapids", "raft", "splash", "shoot the chute")):
        return "Water Ride"
    if any(term in value for term in ("carousel", "roundabout", "junior", "kiddie", "miniature", "monorail", "railway", "walk-through")):
        return "Family Ride"
    return "Flat Ride"


def infobox_value(wikitext: str, key: str) -> str:
    match = re.search(
        rf"^\|[ \t]*{re.escape(key)}[ \t]*=[ \t]*([^\r\n]*)$",
        wikitext,
        re.M | re.I,
    )
    return plain(match.group(1)) if match else ""


def number(value: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    return float(match.group(0)) if match else None


def coaster_stats(wikitext: str) -> dict[str, float | int]:
    units = infobox_value(wikitext, "units").lower()
    length = number(infobox_value(wikitext, "length"))
    speed = number(infobox_value(wikitext, "speed"))
    inversions = number(infobox_value(wikitext, "inversions"))
    if units == "metric":
        length = length * 3.28084 if length is not None else None
        speed = speed * 0.621371 if speed is not None else None
    return {
        **({"trackLengthFeet": round(length, 1)} if length is not None else {}),
        **({"topSpeedMph": round(speed, 1)} if speed is not None else {}),
        **({"inversions": int(inversions)} if inversions is not None else {}),
    }


def main() -> None:
    park_source = fetch_wikitext([page for _, _, page in PARKS])
    catalogue: list[dict] = []
    coaster_pages: set[str] = set()

    for key, name, page in PARKS:
        attractions: list[dict] = []
        for row in parse_present_tables(park_source[page]):
            is_coaster = bool(row["_coaster"])
            ride_type = row.get("Type", "")
            attraction = {
                "name": row["Name"],
                "category": "Rollercoaster" if is_coaster else category_for(ride_type, row["Name"]),
                "sourcePage": row["_page"],
                **({"coasterType": ride_type} if is_coaster and ride_type else {}),
            }
            if is_coaster:
                coaster_pages.add(row["_page"])
            if attraction["name"] and not any(item["name"].casefold() == attraction["name"].casefold() for item in attractions):
                attractions.append(attraction)
        catalogue.append({"key": key, "name": name, "page": page, "attractions": attractions})

    details = fetch_wikitext(sorted(coaster_pages))
    coaster_types = set(COASTERPEDIA_TYPES)
    for park in catalogue:
        for attraction in park["attractions"]:
            coaster_type = attraction.get("coasterType")
            if coaster_type:
                coaster_types.add(str(coaster_type))
                attraction.update(coaster_stats(details.get(str(attraction["sourcePage"]), "")))

    payload = {"coasterTypes": sorted(coaster_types), "parks": catalogue}
    output = "// Generated from Coasterpedia by scripts/build_coasterpedia_catalog.py\n"
    output += "export const COASTERPEDIA_CATALOG = " + json.dumps(payload, indent=2, ensure_ascii=False) + " as const\n"
    destination = Path(__file__).resolve().parents[1] / "src" / "coasterpediaCatalog.ts"
    destination.write_text(output, encoding="utf-8")
    total = sum(len(park["attractions"]) for park in catalogue)
    print(f"Wrote {total} attractions to {destination}")


if __name__ == "__main__":
    main()
