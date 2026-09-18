import { readFile } from "node:fs/promises";
import { normalizeData, tradeGameMap } from "../src/data/normalize.js";
import { ribbonTaskId } from "../src/data/keys.js";

const dataPath = (name) => new URL(`../assets/data/${name}`, import.meta.url);
const load = async (name, optional = false) => {
  const text = await readFile(dataPath(name), "utf8");
  return text.trim() ? JSON.parse(text) : optional ? {} : undefined;
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const data = {
  challenges: await load("home-challenges.json"),
  exclusives: await load("home-exclusives.json"),
  ribbons: await load("home-ribbons.json"),
  moves: await load("home-moves.json"),
  trades: await load("home-trades.json", true),
};
const model = normalizeData(data);

assert(Object.keys(model.games).length > 0, "Expected a game catalog.");
assert(model.tasks.length > 0, "Expected normalized tasks.");
assert(model.moveCatalog.length > 0, "Expected normalized removed moves.");
assert(model.ribbonGroups.length > 0, "Expected ribbon groups.");
assert(
  model.tasksBySource.challenge?.length > 0,
  "Expected challenge task index.",
);
const unmappedTradeGames = [
  ...new Set(
    (data.trades.records || [])
      .map((record) => record.game)
      .filter((game) => !tradeGameMap[game]),
  ),
];
assert(
  unmappedTradeGames.length === 0,
  `Trade game labels missing from tradeGameMap: ${JSON.stringify(unmappedTradeGames)}`,
);
assert(
  !data.trades.records?.length || model.tasksBySource.trade?.length > 0,
  "Expected trade tasks when trade records are present.",
);
assert(
  model.tasks.every((task) => task.games.every((code) => model.games[code])),
  "Every task game code must exist in the game catalog.",
);
assert(
  model.moveCatalog.every((move) =>
    move.games.every((code) => model.games[code]),
  ),
  "Every move game code must exist in the game catalog.",
);
assert(
  model.tasks.every((task) => task.id && task.name && task.games.length),
  "Every normalized task must have an ID, name, and game.",
);
assert(
  model.tasks.every((task) => Number.isInteger(task.generation)),
  "Every normalized task must have a generation, or generation filters hide it.",
);
// Checkbox state is keyed by ID, so a duplicate would tick two items at once.
const checkableIds = [
  ...model.tasks.map((task) => task.id),
  ...model.moveCatalog.map((move) => move.id),
  ...model.ribbonGroups.flatMap((group) =>
    group.ribbons.map((ribbon) => ribbonTaskId(group.id, ribbon.id)),
  ),
];
const duplicateIds = checkableIds.filter(
  (id, index) => checkableIds.indexOf(id) !== index,
);
assert(
  duplicateIds.length === 0,
  `Task IDs must be unique; duplicated: ${JSON.stringify([...new Set(duplicateIds)])}`,
);
assert(
  model.progressTasks.every((task) => typeof task.searchText === "string"),
  "Every progress task must be searchable.",
);
assert(
  model.moveCatalog.every((move) => move.removedIn && move.games.length),
  "Every move catalog entry must have removal metadata and games.",
);

const secondModel = normalizeData(data);
assert(
  model.tasks.map((task) => task.id).join("\n") ===
    secondModel.tasks.map((task) => task.id).join("\n"),
  "Task IDs must be stable.",
);

console.log(
  `Validated ${model.tasks.length} tasks (${model.tasksBySource.trade?.length || 0} trades), ${model.moveCatalog.length} moves, and ${model.ribbonGroups.length} ribbon groups.`,
);
