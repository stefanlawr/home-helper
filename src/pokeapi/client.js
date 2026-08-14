const TTL = 1000 * 60 * 60 * 24 * 30
const prefix = 'home-helper:pokeapi:'

function slug(value) {
  return value.toLocaleLowerCase().replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function cached(path) {
  const key = `${prefix}${path}`
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (saved && saved.expiresAt > Date.now()) return saved.value
  } catch {}

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/${path}`)
    if (!response.ok) return null
    const value = await response.json()
    localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + TTL }))
    return value
  } catch {
    return null
  }
}

export function getPokemonSprite(name) {
  return cached(`pokemon/${slug(name)}`).then((pokemon) => pokemon?.sprites?.other?.['official-artwork']?.front_default || pokemon?.sprites?.front_default || null)
}

export function getMoveInfo(name) {
  return cached(`move/${slug(name)}`).then((move) => move && ({
    type: move.type?.name,
    damageClass: move.damage_class?.name,
    description: move.flavor_text_entries?.find((entry) => entry.language?.name === 'en')?.flavor_text?.replace(/\s+/g, ' '),
  }))
}

export function getMoveLearners(name, gameCode) {
  const moveSlug = slug(name)
  return cached(`move/${moveSlug}`).then((move) => {
    if (!move) return []
    return (move.learned_by_pokemon || [])
      .map((entry) => entry.name)
      .filter(Boolean)
      .sort()
  })
}

export function getAbilityInfo(name) {
  return cached(`ability/${slug(name)}`).then((ability) => ability && ({
    description: ability.effect_entries?.find((entry) => entry.language?.name === 'en')?.short_effect,
  }))
}
