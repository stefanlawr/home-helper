import { moveTaskId, ribbonTaskId } from "./keys.js";

function stableId(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `exclusive:${(hash >>> 0).toString(16)}`;
}

function clean(value) {
  return String(value).trim();
}

// Precomputes the lower-cased text the search box matches against.
function withSearchText(task) {
  return {
    ...task,
    searchText:
      `${task.name} ${task.description || ""} ${task.platform || ""}`.toLocaleLowerCase(),
  };
}

// Maps the trades sheet's "game" label (including GameCube/Wii/3DS demo transfer chains) to catalog game codes.
export const tradeGameMap = {
  "Red/Blue": ["rby"],
  "Pocket Monsters Blue (JPN)": ["rby"],
  Yellow: ["rby"],
  "Gold/Silver": ["gsc"],
  Crystal: ["gsc"],
  "Ruby/Sapphire": ["rse"],
  "Firered/Leafgreen": ["frlg"],
  Emerald: ["rse"],
  "Diamond / Pearl / Platinum": ["dppt"],
  "Heartgold/Soulsilver": ["hgss"],
  "Black/White": ["bw"],
  "Black 2/White 2": ["b2w2"],
  "X/Y": ["xy"],
  "Omega Ruby / Alpha Sapphire": ["oras"],
  "Sun/Moon": ["sm"],
  "Ultra Sun/Ultra Moon": ["usum"],
  "Colosseum\n↓\nRSE and FRLG": ["colosseum"],
  "Channel\n↓\nRS": ["channel"],
  "XD Gale of Darkness\n↓\nRSE and FRLG": ["xd"],
  "GameCube Interactive Multi-Game Demo Disc 14 or 16\n↓\nRuby, Sapphire": [
    "gc-demo",
  ],
  "Battle Revolution\n↓\nDPPl and HGSS": ["battle-revolution"],
  "Pokémon Ranger\n↓\nDPPl and HGSS": ["ranger"],
  "Dream Radar\n↓\nB2W2": ["dream-radar"],
  "Omega Ruby and Alpha Sapphire Demo\n↓\nORAS": ["oras-demo"],
  "Sun and Moon Demo\n↓\nSM": ["sm-demo"],
  "Pokémon Box: Ruby and Sapphire\n↓\nRSE and FRLG": ["box"],
  "My Pokémon Ranch\n↓\nDPPl": ["ranch"],
};

function normalizeTradeCategory(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "Other";
  }

  return text
    .replace(/\s+/g, " ")
    .replace(/\bpokemon\b/gi, "Pokémon")
    .replace(
      /(^|\s)([a-z])/g,
      (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`,
    );
}

function describeTrade(record) {
  const parts = [];
  if (
    record.category === "In-game trade" &&
    record.trainer_requests &&
    record.trainer_requests !== "-"
  ) {
    const nicknameNote =
      record.nickname && record.nickname !== "-"
        ? ` (nicknamed ${clean(record.nickname)})`
        : "";
    parts.push(
      `Give ${clean(record.trainer_requests)}, receive ${clean(record.pokemon)}${nicknameNote}`,
    );
  }
  if (record.ot_id && !/player'?s/i.test(record.ot_id)) {
    parts.push(`OT: ${clean(record.ot_id)}`);
  }
  if (record.comments) {
    parts.push(clean(record.comments));
  }
  if (record.access_path?.includes("→")) {
    parts.push(`Access: ${record.access_path.replace(/\n/g, " ")}`);
  }
  return parts.join("\n");
}

export const gameGenerations = {
  rby: 1,
  gsc: 2,
  rse: 3,
  frlg: 3,
  dppt: 4,
  hgss: 4,
  bw: 5,
  b2w2: 5,
  xy: 6,
  oras: 6,
  sm: 7,
  usum: 7,
  lgpe: 8,
  swsh: 8,
  bdsp: 8,
  pla: 8,
  sv: 9,
  za: 9,
  colosseum: 3,
  xd: 3,
  box: 3,
  channel: 3,
  "gc-demo": 3,
  ranch: 4,
  "battle-revolution": 4,
  ranger: 4,
  "dream-radar": 5,
  "oras-demo": 6,
  "sm-demo": 7,
};
const challengeGames = new Set(
  Object.entries(gameGenerations)
    .filter(([, generation]) => generation <= 7)
    .map(([code]) => code),
);

function hasPreAndPostGen7Game(challenge) {
  const generations = (challenge.games || [])
    .map((code) => gameGenerations[code])
    .filter((generation) => generation != null);

  return (
    generations.some((generation) => generation < 7) &&
    generations.some((generation) => generation > 7)
  );
}

export function ribbonGroupTitle(group) {
  return group.title || group.id.replaceAll("_", " ");
}

function groupBySource(tasks) {
  const bySource = {};
  for (const task of tasks) {
    (bySource[task.source] ||= []).push(task);
  }
  return bySource;
}

// Links an exclusive to a challenge in one of its own games that names it as a whole word,
// so "Mew" never matches "Mewtwo".
function findLinkedChallenge(name, games, challengeTasks) {
  const escaped = clean(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, "iu");
  return (
    challengeTasks
      .filter(
        (task) =>
          task.games.some((code) => games.includes(code)) &&
          pattern.test(task.name),
      )
      .sort((a, b) => {
        const score = (value) => {
          let total = 0;
          if (value.toLocaleLowerCase().includes("register")) {
            total += 4;
          }
          if (value.toLocaleLowerCase().includes("fill")) {
            total += 3;
          }
          if (value.toLocaleLowerCase().includes("deposit")) {
            total += 1;
          }
          return total + value.length;
        };
        return score(b.name) - score(a.name);
      })[0]?.name || null
  );
}

export function normalizeData(data) {
  const games = {
    ...(data.challenges.games || {}),
    ranger: "Pokémon Ranger",
    "gc-demo": "GameCube Multi-Game Demo Disc",
    "oras-demo": "Omega Ruby & Alpha Sapphire Demo",
    "sm-demo": "Sun & Moon Demo",
  };
  const tasks = (data.challenges.challenges || [])
    .filter((challenge) => !hasPreAndPostGen7Game(challenge))
    .map((challenge) => {
      const games = (challenge.games || []).filter((code) =>
        challengeGames.has(code),
      );
      return {
        id: `challenge:${challenge.id}`,
        source: "challenge",
        category: challenge.category || "pokemon",
        name: clean(challenge.name),
        description: challenge.description || "",
        games,
        // Taken from the kept games, since the raw list can start with "any" or "go".
        generation: challenge.generation || gameGenerations[games[0]] || null,
      };
    })
    .filter((task) => task.games.length && task.generation <= 7);

  // Only the categories the app shows become tasks; the exclusive move lists feed moveCatalog below.
  const categoryMap = {
    home_challenges: "pokemon",
    notable_shinies: "shiny",
  };
  const challengeTasks = [...tasks];

  for (const group of data.exclusives.games || []) {
    for (const [key, values] of Object.entries(group.categories || {})) {
      if (!categoryMap[key] || !Array.isArray(values)) {
        continue;
      }
      for (const value of values) {
        const name = clean(value);
        const linkedChallenge = findLinkedChallenge(
          name,
          group.games || [],
          challengeTasks,
        );
        tasks.push({
          id: stableId(`${group.id}:${key}:${name}`),
          source: "exclusive",
          category: categoryMap[key],
          name,
          description: `${group.platform} preservation target`,
          games: group.games || [],
          generation: group.generation || null,
          platform: group.platform,
          linkedChallenge,
        });
      }
    }
  }

  const tradeTasks = (data.trades?.records || [])
    .map((record) => ({
      id: `trade:${record.id}`,
      source: "trade",
      category: normalizeTradeCategory(record.category || "Trade"),
      name: clean(record.pokemon),
      description: describeTrade(record),
      games: tradeGameMap[record.game] || [],
      generation: Number(String(record.generation).match(/\d+/)?.[0]) || null,
    }))
    .filter((task) => task.games.length && task.generation <= 7);
  tasks.push(...tradeTasks);

  const removedMoves = data.exclusives.global_targets?.removed_moves || {};
  const removedLookup = new Map();
  for (const [generation, names] of Object.entries(removedMoves)) {
    for (const name of names) {
      removedLookup.set(name.toLocaleLowerCase(), generation);
    }
  }
  const moveGames = new Map();
  for (const group of data.exclusives.games || []) {
    for (const name of group.categories?.moves || []) {
      const key = name.toLocaleLowerCase();
      const gamesForMove = moveGames.get(key) || new Set();
      for (const code of group.games || []) {
        if (gameGenerations[code] <= 7) {
          gamesForMove.add(code);
        }
      }
      moveGames.set(key, gamesForMove);
    }
  }
  const moveCatalog = (data.moves.moves || [])
    .filter((move) => removedLookup.has(move.name.toLocaleLowerCase()))
    .map((move) =>
      withSearchText({
        ...move,
        id: moveTaskId(move.name),
        source: "move",
        category: "move",
        description: "",
        generation: move.generations?.[0] || null,
        generations: move.generations || [],
        games: [
          ...(moveGames.get(move.name.toLocaleLowerCase()) ||
            Object.keys(games).filter(
              (code) =>
                gameGenerations[code] <= 7 &&
                move.generations?.includes(gameGenerations[code]),
            )),
        ],
        removedIn: removedLookup.get(move.name.toLocaleLowerCase()),
      }),
    );

  const ribbonGroups = data.ribbons.ribbon_groups || [];
  const ribbonTasks = ribbonGroups
    .filter(
      (group) => group.origin_generation >= 1 && group.origin_generation <= 7,
    )
    .flatMap((group) =>
      group.ribbons.map((ribbon) =>
        withSearchText({
          id: ribbonTaskId(group.id, ribbon.id),
          source: "ribbon",
          category: "ribbon",
          name: ribbon.name,
          description: ribbonGroupTitle(group),
          generation: group.origin_generation,
          games: group.origin_games.filter(
            (code) => gameGenerations[code] <= 7,
          ),
        }),
      ),
    );

  const searchableTasks = tasks.map(withSearchText);
  const tasksBySource = groupBySource(searchableTasks);
  const progressTasks = [
    ...(tasksBySource.challenge || []),
    ...(tasksBySource.exclusive || []).filter(
      (task) => task.generation >= 1 && task.generation <= 7,
    ),
    ...(tasksBySource.trade || []),
    ...moveCatalog,
    ...ribbonTasks,
  ];

  return {
    games,
    tasks: searchableTasks,
    tasksBySource,
    moveCatalog,
    ribbonGroups,
    progressTasks,
  };
}
