# Refreshing Move Data

`assets/utils/build_home_moves.py` is an offline maintenance script. It is not part of the frontend build or normal development workflow.

## Requirements

Use Python 3.10 or newer and install the script dependencies:

```powershell
python -m pip install requests beautifulsoup4
```

The script requires network access to `pokemondb.net`. It fetches the move index, generation indexes, and individual move pages. The source site may rate-limit requests, so run refreshes deliberately.

## Refresh

Run this command from the repository root:

```powershell
python assets/utils/build_home_moves.py
```

The script validates ordering, duplicate names, generation ranges, and empty generation results before writing `assets/data/home-moves.json`.

## Verify

After a refresh, run the local catalog contract and production build:

```powershell
npm run check:data
npm run build
```

Review the generated JSON diff before deploying. Unexpected move counts, unknown game labels, or a large unrelated diff should be investigated rather than committed automatically.
