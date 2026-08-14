import { readFile } from "node:fs/promises";
import { normalizeData } from "../src/data/normalize.js";

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
  abilities: await load("home-abilities.json", true),
};
const model = normalizeData(data);

assert(Object.keys(model.games).length > 0, "Expected a game catalog.");
assert(model.tasks.length > 0, "Expected normalized tasks.");
assert(model.moveCatalog.length > 0, "Expected normalized removed moves.");
assert(model.ribbonGroups.length > 0, "Expected ribbon groups.");
assert(model.taskIndex.bySource.challenge?.length > 0, "Expected challenge task index.");
assert(Object.keys(model.moveIndex.byGame).length > 0, "Expected move game index.");
assert(
  model.tasks.every((task) => task.games.every((code) => model.games[code])),
  "Every task game code must exist in the game catalog.",
);
assert(
  model.moveCatalog.every((move) => move.games.every((code) => model.games[code])),
  "Every move game code must exist in the game catalog.",
);
assert(
  model.tasks.every((task) => task.id && task.name && task.games.length),
  "Every normalized task must have an ID, name, and game.",
);
assert(
  model.moveCatalog.every((move) => move.removedIn && move.games.length),
  "Every move catalog entry must have removal metadata and games.",
);

const firstTask = model.tasks[0];
const secondModel = normalizeData(data);
assert(
  model.tasks.map((task) => task.id).join("\n") ===
    secondModel.tasks.map((task) => task.id).join("\n"),
  "Task IDs must be stable.",
);
assert(firstTask.id === secondModel.tasks[0].id, "Task IDs must be stable.");
assert(
  !data.abilities || typeof data.abilities === "object",
  "Optional abilities data must be empty or an object.",
);

console.log(`Validated ${model.tasks.length} tasks, ${model.moveCatalog.length} moves, and ${model.ribbonGroups.length} ribbon groups.`);
