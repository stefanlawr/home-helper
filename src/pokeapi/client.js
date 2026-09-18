import { gameGenerations } from '../data/normalize.js'

const TTL = 1000 * 60 * 60 * 24 * 30
const prefix = 'home-helper:pokeapi:v2:'
const legacyPrefix = 'home-helper:pokeapi:'
const pending = new Map()
// Highest National Dex number introduced by each generation.
const generationDexLimits = { 1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 809 }

function slug(value) {
  return value.toLocaleLowerCase().replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function englishEntry(entries) {
  return entries?.find((entry) => entry.language?.name === 'en')
}

function dexNumber(url) {
  return Number(url?.match(/\/(\d+)\/?$/)?.[1]) || null
}

// Drops expired entries and the raw responses cached by earlier versions, which could fill the storage quota.
function pruneStorage() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(legacyPrefix)) {
        continue
      }
      let expired = !key.startsWith(prefix)
      if (!expired) {
        try {
          expired = !(JSON.parse(localStorage.getItem(key))?.expiresAt > Date.now())
        } catch {
          expired = true
        }
      }
      if (expired) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage may be unavailable (private mode, blocked cookies).
  }
}

pruneStorage()

// Fetches a PokeAPI resource and caches only the value `pick` derives from it.
// Rejects on failure so callers can show an error and retry.
function cached(path, pick) {
  const key = `${prefix}${path}`
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (saved && saved.expiresAt > Date.now()) {
      return Promise.resolve(saved.value)
    }
  } catch {
    // Ignore malformed cache entries.
  }

  if (pending.has(path)) {
    return pending.get(path)
  }

  const request = fetch(`https://pokeapi.co/api/v2/${path}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`PokeAPI ${path} returned ${response.status}`)
      }
      const value = pick(await response.json())
      try {
        localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + TTL }))
      } catch {
        // Ignore storage quota issues.
      }
      return value
    })
    .finally(() => pending.delete(path))

  pending.set(path, request)
  return request
}

function getMove(name) {
  return cached(`move/${slug(name)}`, (move) => ({
    type: move.type?.name,
    damageClass: move.damage_class?.name,
    description: englishEntry(move.flavor_text_entries)?.flavor_text?.replace(/\s+/g, ' '),
    learners: (move.learned_by_pokemon || []).map((entry) => [entry.name, dexNumber(entry.url)]),
  }))
}

export function getMoveInfo(name) {
  return getMove(name).then(({ type, damageClass, description }) => ({ type, damageClass, description }))
}

// PokeAPI only lists learners per version group on each Pokémon's record, which is too heavy to fetch
// for every learner. Instead, list every Pokémon that learns the move in any game, limited to species
// that existed by the game's generation.
export function getMoveLearners(name, gameCode) {
  const dexLimit = generationDexLimits[gameGenerations[gameCode]] || Infinity
  return getMove(name).then(({ learners }) =>
    learners
      .filter(([, number]) => number && number <= dexLimit)
      .map(([pokemon]) => pokemon)
      .sort(),
  )
}

export function getAbilityInfo(name) {
  return cached(`ability/${slug(name)}`, (ability) => ({
    description: englishEntry(ability.effect_entries)?.short_effect,
  }))
}
