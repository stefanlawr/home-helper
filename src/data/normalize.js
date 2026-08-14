function stableId(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `exclusive:${(hash >>> 0).toString(16)}`
}

function clean(value) {
  return String(value).trim()
}

function isPriority(name, globalTargets) {
  const needle = name.toLocaleLowerCase()
  return [...(globalTargets.switch_unavailable_or_transfer_critical || []), ...(globalTargets.notable_shiny_preservation_targets || [])]
    .some((target) => needle.includes(String(target).toLocaleLowerCase()))
}

export const gameGenerations = { rby: 1, gsc: 2, rse: 3, frlg: 3, dppt: 4, hgss: 4, bw: 5, b2w2: 5, xy: 6, oras: 6, sm: 7, usum: 7, lgpe: 8, swsh: 8, bdsp: 8, pla: 8, sv: 9, za: 9 }
const challengeGames = new Set(Object.entries(gameGenerations).filter(([, generation]) => generation <= 7).map(([code]) => code))

function hasPreAndPostGen7Game(challenge) {
  const generations = (challenge.games || [])
    .map((code) => gameGenerations[code])
    .filter((generation) => generation != null)

  return generations.some((generation) => generation < 7) && generations.some((generation) => generation > 7)
}

export function normalizeData(data) {
  const games = data.challenges.games || {}
  const tasks = (data.challenges.challenges || [])
    .filter((challenge) => !hasPreAndPostGen7Game(challenge))
    .map((challenge) => ({
      id: `challenge:${challenge.id}`,
      source: 'challenge',
      category: challenge.category || 'pokemon',
      name: clean(challenge.name),
      description: challenge.description || '',
      games: (challenge.games || []).filter((code) => challengeGames.has(code)),
      generation: challenge.generation || gameGenerations[challenge.games?.[0]] || null,
      priority: isPriority(challenge.name, data.exclusives.global_targets || {}),
    }))
    .filter((task) => task.games.length && task.generation <= 7)

  const categoryMap = {
    home_challenges: 'pokemon',
    notable_shinies: 'shiny',
    moves: 'move',
    abilities: 'ability',
    ribbons: 'ribbon',
    notable_gifts: 'gift',
    ball_properties: 'special',
    special: 'special',
  }

  for (const group of data.exclusives.games || []) {
    for (const [key, values] of Object.entries(group.categories || {})) {
      if (!categoryMap[key] || !Array.isArray(values)) continue
      for (const value of values) {
        const name = clean(value)
        tasks.push({
          id: stableId(`${group.id}:${key}:${name}`),
          source: 'exclusive',
          category: categoryMap[key],
          name,
          description: `${group.platform} preservation target`,
          games: group.games || [],
          generation: group.generation || null,
          platform: group.platform,
          priority: isPriority(name, data.exclusives.global_targets || {}),
        })
      }
    }
  }

  const removedMoves = data.exclusives.global_targets?.removed_moves || {}
  const removedLookup = new Map()
  for (const [generation, names] of Object.entries(removedMoves)) {
    for (const name of names) removedLookup.set(name.toLocaleLowerCase(), generation)
  }
  const moveGames = new Map()
  for (const group of data.exclusives.games || []) {
    for (const name of group.categories?.moves || []) {
      const key = name.toLocaleLowerCase()
      const gamesForMove = moveGames.get(key) || new Set()
      for (const code of group.games || []) {
        if (gameGenerations[code] <= 7) gamesForMove.add(code)
      }
      moveGames.set(key, gamesForMove)
    }
  }
  const moveCatalog = (data.moves.moves || [])
    .map((move) => ({
      ...move,
      games: [
        ...(moveGames.get(move.name.toLocaleLowerCase()) || new Set(
          Object.keys(games).filter(
            (code) =>
              gameGenerations[code] <= 7 &&
              move.generations?.includes(gameGenerations[code]),
          ),
        )),
      ],
      removedIn: removedLookup.get(move.name.toLocaleLowerCase()) || null,
    }))
    .filter((move) => move.removedIn)

  const ribbonGroups = data.ribbons.ribbon_groups || []

  return {
    games,
    tasks,
    moveCatalog,
    ribbonGroups,
    globalTargets: data.exclusives.global_targets || {},
  }
}
