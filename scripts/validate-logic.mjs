import { normalizeData } from "../src/data/normalize.js";
import { createTaskFilter, groupByGame } from "../src/data/filters.js";
import { categoryKey, tradeViewKey } from "../src/data/keys.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const ids = (items) =>
  items
    .map((item) => item.id)
    .sort()
    .join(",");

// Keys
assert(categoryKey("Gift Pokémon") === "gift-pokemon", "Keys fold accents.");
assert(categoryKey("  In-game Trade ") === "in-game-trade", "Keys are slugs.");
assert(tradeViewKey("Egg") === "trade:egg", "Trade views are prefixed.");

// Filtering
const items = [
  { id: "a", searchText: "venusaur fr", games: ["frlg"], generation: 3 },
  { id: "b", searchText: "mew event", games: ["rby", "gsc"], generation: 1 },
  { id: "m", searchText: "assist", games: ["rse"], generations: [3, 4] },
];
const filter = (options) =>
  items.filter(
    createTaskFilter({
      query: "",
      selectedGames: [],
      generation: "all",
      status: "all",
      completed: new Set(["b"]),
      ...options,
    }),
  );
assert(ids(filter({})) === "a,b,m", "No filters keeps everything.");
assert(ids(filter({ query: "MEW" })) === "b", "Search ignores case.");
assert(ids(filter({ selectedGames: ["gsc"] })) === "b", "Any selected game.");
assert(ids(filter({ generation: "3" })) === "a,m", "Generation filter.");
assert(ids(filter({ generation: "4" })) === "m", "Moves match any generation.");
assert(ids(filter({ status: "done" })) === "b", "Done status.");
assert(ids(filter({ status: "todo" })) === "a,m", "To-do status.");

// Grouping
const groups = groupByGame(items);
assert(
  ids(groups.get("rby")) === "b" && ids(groups.get("gsc")) === "b",
  "Items appear under each of their games.",
);

// Normalization
const model = normalizeData({
  challenges: {
    games: { rby: "Red", gsc: "Gold", rse: "Ruby", frlg: "FireRed", xy: "X" },
    challenges: [
      { id: "any-first", name: "Register Treecko", games: ["any", "rse"] },
      { id: "cross-gen", name: "Span", games: ["xy", "swsh"] },
      { id: "mewtwo", name: "Register Mewtwo", games: ["rby"] },
      { id: "venusaur-fr", name: "Register Venusaur", games: ["frlg"] },
    ],
  },
  exclusives: {
    games: [
      {
        id: "gen1",
        platform: "VC",
        generation: 1,
        games: ["rby"],
        categories: {
          home_challenges: ["Mew", "Venusaur"],
          moves: ["Assist"],
          notable_gifts: ["Hidden"],
        },
      },
    ],
    global_targets: { removed_moves: { gen8: ["Assist"] } },
  },
  ribbons: {
    ribbon_groups: [
      {
        id: "gen3_league",
        title: "Hoenn League",
        origin_generation: 3,
        origin_games: ["rse"],
        ribbons: [{ id: "champion", name: "Champion Ribbon" }],
      },
      {
        id: "gen8_tower",
        origin_generation: 8,
        origin_games: ["swsh"],
        ribbons: [{ id: "tower", name: "Tower Ribbon" }],
      },
    ],
  },
  moves: {
    moves: [
      { name: "Assist", generations: [3, 4] },
      { name: "Tackle", generations: [1, 2, 3] },
    ],
  },
  trades: {
    records: [
      {
        id: 1,
        category: "gift pokemon",
        pokemon: "Eevee",
        game: "Red/Blue",
        generation: "Gen 1",
      },
      { id: 2, pokemon: "Nobody", game: "Unknown", generation: "Gen 3" },
    ],
  },
});
const byId = new Map(model.tasks.map((task) => [task.id, task]));

assert(
  byId.get("challenge:any-first")?.generation === 3,
  "Challenge generation comes from its first kept game.",
);
assert(
  !byId.has("challenge:cross-gen"),
  "Challenges spanning Gen 7 are dropped.",
);
const exclusives = model.tasksBySource.exclusive;
assert(
  exclusives.map((task) => task.name).join(",") === "Mew,Venusaur",
  "Only shown exclusive categories become tasks.",
);
assert(
  exclusives.every((task) => task.linkedChallenge === null),
  "Links need a whole-word name match in a shared game (not Mewtwo, not FireRed).",
);
assert(
  model.tasksBySource.trade.length === 1 &&
    model.tasksBySource.trade[0].category === "Gift Pokémon",
  "Trades normalize categories and drop unmapped games.",
);
assert(
  model.moveCatalog.map((move) => move.id).join(",") === "move:Assist" &&
    model.moveCatalog[0].games.join(",") === "rby",
  "Only removed moves are kept, under their exclusive games.",
);
const ribbons = model.progressTasks.filter((task) => task.source === "ribbon");
assert(
  ribbons.length === 1 && ribbons[0].searchText.includes("hoenn league"),
  "Gen 1-7 ribbons are searchable by group title.",
);

console.log(
  "Validated keys, filtering, grouping, and normalization edge cases.",
);
