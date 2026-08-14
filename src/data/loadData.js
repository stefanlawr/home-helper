const DATA_FILES = {
  challenges: 'assets/data/home-challenges.json',
  exclusives: 'assets/data/home-exclusives.json',
  ribbons: 'assets/data/home-ribbons.json',
  moves: 'assets/data/home-moves.json',
  abilities: 'assets/data/home-abilities.json',
}

async function loadJson(path, optional = false) {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
  if (!response.ok) {
    // Only auxiliary catalogs may be absent; required catalogs must fail loudly.
    if (optional) return {}
    throw new Error(`Unable to load ${path} (${response.status})`)
  }
  const text = await response.text()
  return text.trim() ? JSON.parse(text) : {}
}

export async function loadHomeData() {
  const [challenges, exclusives, ribbons, moves, abilities] = await Promise.all([
    loadJson(DATA_FILES.challenges),
    loadJson(DATA_FILES.exclusives),
    loadJson(DATA_FILES.ribbons),
    loadJson(DATA_FILES.moves),
    loadJson(DATA_FILES.abilities, true),
  ])

  return { challenges, exclusives, ribbons, moves, abilities }
}
