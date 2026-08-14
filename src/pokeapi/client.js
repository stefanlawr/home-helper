const TTL = 1000 * 60 * 60 * 24 * 30
const prefix = 'home-helper:pokeapi:'
const pending = new Map()
const learnerPending = new Map()
const learnerCache = new Map()
const LEARNER_CACHE_TTL = 1000 * 60 * 60
const LEARNER_CONCURRENCY = 4
const gameVersionGroups = {
  rby: ['red-blue', 'yellow'],
  gsc: ['gold-silver', 'crystal'],
  rse: ['ruby-sapphire', 'emerald'],
  frlg: ['firered-leafgreen'],
  dppt: ['diamond-pearl', 'platinum'],
  hgss: ['heartgold-soulsilver'],
  bw: ['black-white'],
  b2w2: ['black-2-white-2'],
  xy: ['x-y'],
  oras: ['omega-ruby-alpha-sapphire'],
  sm: ['sun-moon'],
  usum: ['ultra-sun-ultra-moon'],
}

function slug(value) {
  return value.toLocaleLowerCase().replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function cached(path) {
  const key = `${prefix}${path}`
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (saved && saved.expiresAt > Date.now()) return saved.value
  } catch {}

  if (pending.has(path)) return pending.get(path)

  const request = fetch(`https://pokeapi.co/api/v2/${path}`)
    .then(async (response) => {
      if (!response.ok) return null
      const value = await response.json()
      try {
        localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + TTL }))
      } catch {}
      return value
    })
    .catch(() => null)
    .finally(() => pending.delete(path))

  pending.set(path, request)
  return request
}

async function mapWithConcurrency(items, worker, limit) {
  const results = new Array(items.length)
  let nextIndex = 0
  const run = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
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
  const learnerKey = `${moveSlug}:${gameCode}`
  const saved = learnerCache.get(learnerKey)
  if (saved && saved.expiresAt > Date.now()) return Promise.resolve(saved.value)
  learnerCache.delete(learnerKey)
  if (learnerPending.has(learnerKey)) return learnerPending.get(learnerKey)
  const versionGroups = new Set(gameVersionGroups[gameCode] || [])
  const request = cached(`move/${moveSlug}`).then(async (move) => {
    if (!move) return []
    const learners = await mapWithConcurrency(
      move.learned_by_pokemon || [],
      async (entry) => {
        const pokemon = await cached(`pokemon/${entry.name}`)
        const moveDetails = pokemon?.moves?.find(
          (candidate) => candidate.move?.name === moveSlug,
        )?.version_group_details
        return moveDetails?.some((detail) =>
          versionGroups.has(detail.version_group?.name),
        )
          ? entry.name
          : null
      },
      LEARNER_CONCURRENCY,
    )
    return learners.filter(Boolean).sort()
  }).then((value) => {
    learnerCache.set(learnerKey, { value, expiresAt: Date.now() + LEARNER_CACHE_TTL })
    return value
  }).finally(() => learnerPending.delete(learnerKey))
  learnerPending.set(learnerKey, request)
  return request
}

export function getAbilityInfo(name) {
  return cached(`ability/${slug(name)}`).then((ability) => ability && ({
    description: ability.effect_entries?.find((entry) => entry.language?.name === 'en')?.short_effect,
  }))
}
