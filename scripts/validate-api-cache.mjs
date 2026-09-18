const storage = new Map([
  ["home-helper:pokeapi:pokemon/pikachu", "legacy raw response"],
  ["home-helper:completed", "[]"],
]);
globalThis.localStorage = {
  get length() {
    return storage.size;
  },
  key: (index) => [...storage.keys()][index] ?? null,
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

let fetchCount = 0;

globalThis.fetch = async (url) => {
  fetchCount += 1;
  await new Promise((resolve) => setTimeout(resolve, 1));
  const path = new URL(url).pathname.split("/api/v2/")[1];
  if (path === "move/tackle" || path === "move/growl") {
    return {
      ok: true,
      json: async () => ({
        learned_by_pokemon: [
          ["bulbasaur", 1],
          ["pikachu", 25],
          ["mew", 151],
          ["chikorita", 152],
          ["pikachu-alola-cap", 10095],
          ["raichu", 26],
          ["raichu-alola", 10100],
          ["deoxys-normal", 386],
          ["deoxys-attack", 10001],
          ["venusaur", 3],
          ["venusaur-mega", 10033],
          ["meowth-galar", 10161],
          ["missingno-form", 10999],
        ].map(([name, id]) => ({
          name,
          url: `https://pokeapi.co/api/v2/pokemon/${id}/`,
        })),
        type: { name: "normal" },
        damage_class: { name: "physical" },
        flavor_text_entries: [
          { language: { name: "en" }, flavor_text: "A\nphysical attack." },
        ],
        unused_large_field: "x".repeat(10000),
      }),
    };
  }
  if (path === "move/missing") {
    return { ok: false, status: 404 };
  }
  throw new Error(`Unexpected API path: ${path}`);
};

const { getMoveInfo, getMoveLearners } =
  await import("../src/pokeapi/client.js");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  !storage.has("home-helper:pokeapi:pokemon/pikachu"),
  "Legacy raw cache entries must be pruned.",
);
assert(
  storage.has("home-helper:completed"),
  "Pruning must not touch saved progress.",
);

const learners = await getMoveLearners("Tackle", "rby");
assert(
  fetchCount === 1,
  `Expected one request for move learners, saw ${fetchCount}.`,
);
assert(
  learners.join(",") === "bulbasaur,mew,pikachu,raichu,venusaur",
  `Expected Gen 1 species only, got ${learners.join(",")}.`,
);
const gen2Learners = await getMoveLearners("Tackle", "gsc");
assert(
  gen2Learners.includes("chikorita"),
  "Gen 2 games must include Gen 2 species.",
);
const gen3Learners = await getMoveLearners("Tackle", "rse");
assert(
  gen3Learners.includes("deoxys-attack") &&
    !gen3Learners.includes("venusaur-mega"),
  "Forms count from their species' generation unless introduced later.",
);
const gen7Learners = await getMoveLearners("Tackle", "sm");
assert(
  ["raichu-alola", "pikachu-alola-cap", "venusaur-mega"].every((name) =>
    gen7Learners.includes(name),
  ),
  "Gen 7 games must include Alolan forms, caps, and Megas.",
);
assert(
  !gen7Learners.includes("meowth-galar") &&
    !gen7Learners.includes("missingno-form"),
  "Later regional forms and forms without a known species must be excluded.",
);

const info = await getMoveInfo("Tackle");
assert(fetchCount === 1, "Move details must reuse the cached move.");
assert(
  info.description === "A physical attack.",
  "Expected normalized English flavor text.",
);

const cachedEntry = storage.get("home-helper:pokeapi:v2:move/tackle");
assert(
  cachedEntry && !cachedEntry.includes("unused_large_field"),
  "Only derived move data may be cached.",
);

const beforeConcurrentInfo = fetchCount;
await Promise.all([getMoveInfo("Growl"), getMoveInfo("Growl")]);
assert(
  fetchCount === beforeConcurrentInfo + 1,
  "Concurrent move detail requests should share one fetch.",
);

const failure = await getMoveInfo("Missing").then(
  () => null,
  (error) => error,
);
assert(
  failure instanceof Error,
  "Failed requests must reject so the UI can show an error.",
);
assert(
  !storage.has("home-helper:pokeapi:v2:move/missing"),
  "Failed requests must not be cached.",
);

console.log(
  "Validated single-request learners, derived-only caching, legacy pruning, deduplication, and error propagation.",
);
