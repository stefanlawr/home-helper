import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://pokemondb.net"
INDEX_URL = f"{BASE_URL}/move/all"
OUTPUT_PATH = Path("assets/data/home-moves.json")
UNAVAILABLE_TEXT = "this move can’t be used"
HEADERS = {"User-Agent": "Home-Helper move availability dataset builder/1.0"}


def generation_for_game_label(label: str) -> int | None:
    normalized = re.sub(r"[\s\u200b]+", "", label.casefold())
    if any(game in normalized for game in ("red/blue", "yellow")):
        return 1
    if any(game in normalized for game in ("gold/silver", "crystal")):
        return 2
    if any(game in normalized for game in ("ruby/sapphire", "emerald", "firered/leafgreen")):
        return 3
    if any(game in normalized for game in ("diamond/pearl", "platinum", "heartgold/soulsilver")):
        return 4
    if any(game in normalized for game in ("black/white", "black 2/white 2", "black2/white2")):
        return 5
    if any(game in normalized for game in ("x/y", "o.ruby/a.sapphire")):
        return 6
    if any(game in normalized for game in ("sun/moon", "ultrasun/ultramoon", "l.g.pikachu/l.g.eevee")):
        return 7
    if any(game in normalized for game in ("sword/shield", "b.diamond/s.pearl", "legends:arceus")):
        return 8
    if any(game in normalized for game in ("scarlet/violet", "legends:z-a")):
        return 9
    return None


def get_soup(session: requests.Session, url: str) -> BeautifulSoup:
    for attempt in range(4):
        response = session.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            return BeautifulSoup(response.text, "html.parser")
        time.sleep(1 + attempt)
    response.raise_for_status()
    raise RuntimeError(f"Unable to fetch {url}")


def get_index_moves() -> dict[str, str]:
    with requests.Session() as session:
        soup = get_soup(session, INDEX_URL)
    moves = {}
    for link in soup.select("a[href^='/move/']"):
        href = link["href"]
        if re.fullmatch(r"/move/[a-z0-9-]+", href):
            moves[href] = link.get_text(" ", strip=True)
    if not moves:
        raise RuntimeError("No move links were found in the Pokemon Database move index.")
    return moves


def get_introduced_generations() -> dict[str, int]:
    introduced = {}
    with requests.Session() as session:
        for generation in range(1, 10):
            soup = get_soup(session, f"{BASE_URL}/move/generation/{generation}")
            for link in soup.select("a[href^='/move/']"):
                href = link["href"]
                if re.fullmatch(r"/move/[a-z0-9-]+", href):
                    introduced[href] = generation
    return introduced


def get_move_generations(move_path: str) -> tuple[str, set[int], set[str]]:
    with requests.Session() as session:
        soup = get_soup(session, f"{BASE_URL}{move_path}")
    heading = soup.find("h2", string=lambda text: text and text.strip() == "Game descriptions")
    if heading is None:
        # These current index entries are either Gen 8 G-Max moves or Gen 9 moves.
        generation = 8 if move_path.startswith("/move/g-max-") else 9
        return move_path, {generation}, set()
    table = heading.find_next_sibling("div", class_="resp-scroll").find("table")
    generations = set()
    unknown_labels = set()
    for row in table.select("tr"):
        game_cell = row.find("th")
        description_cell = row.find("td")
        if game_cell is None or description_cell is None:
            continue
        game_label = game_cell.get_text(" ", strip=True)
        description = description_cell.get_text(" ", strip=True).casefold()
        generation = generation_for_game_label(game_label)
        if generation is None:
            unknown_labels.add(game_label)
        elif UNAVAILABLE_TEXT not in description:
            generations.add(generation)
    return move_path, generations, unknown_labels


def validate(data: dict) -> None:
    assert set(data) == {"moves"}
    assert isinstance(data["moves"], list)
    names = [move["name"] for move in data["moves"]]
    assert names == sorted(names, key=str.casefold)
    assert len(names) == len(set(names))
    for move in data["moves"]:
        assert set(move) == {"name", "generations"}
        assert isinstance(move["name"], str)
        assert move["generations"] == sorted(set(move["generations"]))
        assert all(isinstance(generation, int) and 1 <= generation <= 9 for generation in move["generations"])


def main() -> None:
    index_moves = get_index_moves()
    introduced_generations = get_introduced_generations()
    missing_introductions = set(index_moves) - set(introduced_generations)
    if missing_introductions:
        raise RuntimeError(f"Move-index entries missing from generation indexes: {sorted(missing_introductions)}")
    results = {}
    unresolved_labels = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(get_move_generations, path) for path in index_moves]
        for position, future in enumerate(as_completed(futures), start=1):
            move_path, generations, labels = future.result()
            results[move_path] = generations | {introduced_generations[move_path]}
            if labels:
                unresolved_labels[move_path] = sorted(labels)
            if position % 100 == 0:
                print(f"Processed {position}/{len(index_moves)} moves")

    if unresolved_labels:
        raise RuntimeError(f"Unknown game labels require review: {unresolved_labels}")

    data = {
        "moves": [
            {"name": name, "generations": sorted(results[path])}
            for path, name in sorted(index_moves.items(), key=lambda item: item[1].casefold())
        ]
    }
    for move in data["moves"]:
        if move["name"].startswith(("Max ", "G-Max ")):
            move["generations"] = [8]
    struggle = next(move for move in data["moves"] if move["name"] == "Struggle")
    struggle["generations"] = list(range(1, 10))
    validate(data)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    no_generation = [move["name"] for move in data["moves"] if not move["generations"]]
    print(f"Total moves: {len(data['moves'])}")
    print(f"Moves with at least one generation: {len(data['moves']) - len(no_generation)}")
    print(f"Moves with no determined generation: {len(no_generation)}")
    for generation in range(1, 10):
        count = sum(generation in move["generations"] for move in data["moves"])
        print(f"Generation {generation} moves: {count}")
    print(f"Moves with no determined generation: {no_generation}")


if __name__ == "__main__":
    main()