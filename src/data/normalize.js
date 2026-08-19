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

// Maps the trades sheet's "game" label (including GameCube/Wii/3DS demo transfer chains) to catalog game codes.
const tradeGameMap = {
  'Red/Blue': ['rby'],
  'Pocket Monsters Blue (JPN)': ['rby'],
  'Yellow': ['rby'],
  'Gold/Silver': ['gsc'],
  'Crystal': ['gsc'],
  'Ruby/Sapphire': ['rse'],
  'Firered/Leafgreen': ['frlg'],
  'Emerald': ['rse'],
  'Diamond / Pearl / Platinum': ['dppt'],
  'Heartgold/Soulsilver': ['hgss'],
  'Black/White': ['bw'],
  'Black 2/White 2': ['b2w2'],
  'X/Y': ['xy'],
  'Omega Ruby / Alpha Sapphire': ['oras'],
  'Sun/Moon': ['sm'],
  'Ultra Sun/Ultra Moon': ['usum'],
  'Colosseum\n↓\nRSE and FRLG': ['colosseum'],
  'Channel\n↓\nRS': ['channel'],
  'XD Gale of Darkness\n↓\nRSE and FRLG': ['xd'],
  'GameCube Interactive Multi-Game Demo Disc 14 or 16\n↓\nRuby, Sapphire': ['gc-demo'],
  'Battle Revolution\n↓\nDPPl and HGSS': ['battle-revolution'],
  'Pokémon Ranger\n↓\nDPPl and HGSS': ['ranger'],
  'Dream Radar\n↓\nB2W2': ['dream-radar'],
  'Omega Ruby and Alpha Sapphire Demo\n↓\nORAS': ['oras-demo'],
  'Sun and Moon Demo\n↓\nSM': ['sm-demo'],
  'Pokémon Box: Ruby and Sapphire\n↓\nRSE and FRLG': ['box'],
  'My Pokémon Ranch\n↓\nDPPl': ['ranch'],
}

function describeTrade(record) {
  const parts = []
  if (record.category === 'In-game trade' && record.trainer_requests && record.trainer_requests !== '-') {
    const nicknameNote = record.nickname && record.nickname !== '-' ? ` (nicknamed ${clean(record.nickname)})` : ''
    parts.push(`Give ${clean(record.trainer_requests)}, receive ${clean(record.pokemon)}${nicknameNote}`)
  }
  if (record.ot_id && !/player'?s/i.test(record.ot_id)) parts.push(`OT: ${clean(record.ot_id)}`)
  if (record.comments) parts.push(clean(record.comments))
  if (record.access_path?.includes('→')) parts.push(`Access: ${record.access_path.replace(/\n/g, ' ')}`)
  return parts.join('\n')
}

export const gameGenerations = { rby: 1, gsc: 2, rse: 3, frlg: 3, dppt: 4, hgss: 4, bw: 5, b2w2: 5, xy: 6, oras: 6, sm: 7, usum: 7, lgpe: 8, swsh: 8, bdsp: 8, pla: 8, sv: 9, za: 9, colosseum: 3, xd: 3, box: 3, channel: 3, 'gc-demo': 3, ranch: 4, 'battle-revolution': 4, ranger: 4, 'dream-radar': 5, 'oras-demo': 6, 'sm-demo': 7 }
const challengeGames = new Set(Object.entries(gameGenerations).filter(([, generation]) => generation <= 7).map(([code]) => code))

function hasPreAndPostGen7Game(challenge) {
  const generations = (challenge.games || [])
    .map((code) => gameGenerations[code])
    .filter((generation) => generation != null)

  return generations.some((generation) => generation < 7) && generations.some((generation) => generation > 7)
}

function indexTasks(tasks) {
  const bySource = {}
  const byGame = {}
  for (const task of tasks) {
    const sourceTasks = bySource[task.source] || []
    sourceTasks.push(task)
    bySource[task.source] = sourceTasks
    for (const code of task.games) {
      const gameTasks = byGame[code] || []
      gameTasks.push(task)
      byGame[code] = gameTasks
    }
  }
  return { bySource, byGame }
}

function indexMoves(moves) {
  const byGame = {}
  for (const move of moves) {
    for (const code of move.games) {
      const gameMoves = byGame[code] || []
      gameMoves.push(move)
      byGame[code] = gameMoves
    }
  }
  return { byGame }
}

function findLinkedChallenge(name, challengeTasks) {
  const needle = clean(name).toLocaleLowerCase()
  return challengeTasks
    .filter((task) => task.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => {
      const score = (value) => {
        let total = 0
        if (value.toLocaleLowerCase().includes('register')) total += 4
        if (value.toLocaleLowerCase().includes('fill')) total += 3
        if (value.toLocaleLowerCase().includes('deposit')) total += 1
        return total + value.length
      }
      return score(b.name) - score(a.name)
    })[0]?.name || null
}

export function normalizeData(data) {
  const games = {
    ...(data.challenges.games || {}),
    ranger: 'Pokémon Ranger',
    'gc-demo': 'GameCube Multi-Game Demo Disc',
    'oras-demo': 'Omega Ruby & Alpha Sapphire Demo',
    'sm-demo': 'Sun & Moon Demo',
  }
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

  const challengeTasksForLinking = tasks.filter((task) => task.source === 'challenge')

  for (const group of data.exclusives.games || []) {
    for (const [key, values] of Object.entries(group.categories || {})) {
      if (!categoryMap[key] || !Array.isArray(values)) continue
      for (const value of values) {
        const name = clean(value)
        const linkedChallenge = findLinkedChallenge(name, challengeTasksForLinking)
        tasks.push({
          id: stableId(`${group.id}:${key}:${name}`),
          source: 'exclusive',
          category: categoryMap[key],
          name,
          description: `${group.platform} preservation target`,
          games: group.games || [],
          generation: group.generation || null,
          platform: group.platform,
          linkedChallenge,
          priority: isPriority(name, data.exclusives.global_targets || {}),
        })
      }
    }
  }

  const tradeTasks = (data.trades?.records || [])
    .map((record) => ({
      id: `trade:${record.id}`,
      source: 'trade',
      category: record.category || 'Trade',
      name: clean(record.pokemon),
      description: describeTrade(record),
      games: tradeGameMap[record.game] || [],
      generation: Number(String(record.generation).match(/\d+/)?.[0]) || null,
      priority: false,
    }))
    .filter((task) => task.games.length && task.generation <= 7)
  tasks.push(...tradeTasks)

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
  const taskIndex = indexTasks(tasks)
  const moveIndex = indexMoves(moveCatalog)

  return {
    games,
    tasks,
    moveCatalog,
    taskIndex,
    moveIndex,
    ribbonGroups,
    globalTargets: data.exclusives.global_targets || {},
  }
}
