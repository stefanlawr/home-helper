const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
};

let fetchCount = 0;
let activeRequests = 0;
let maxActiveRequests = 0;

globalThis.fetch = async (url) => {
  fetchCount += 1;
  activeRequests += 1;
  maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
  await new Promise((resolve) => setTimeout(resolve, 1));
  const path = new URL(url).pathname.split("/api/v2/")[1];
  activeRequests -= 1;
  if (path === "move/tackle" || path === "move/growl") {
    return {
      ok: true,
      json: async () => ({
        learned_by_pokemon: ["bulbasaur", "charmander", "squirtle", "pikachu", "eevee", "mew"].map((name) => ({ name })),
        type: { name: "normal" },
        damage_class: { name: "physical" },
        flavor_text_entries: [],
      }),
    };
  }
  if (path.startsWith("pokemon/")) {
    const name = path.slice("pokemon/".length);
    return {
      ok: true,
      json: async () => ({
        name,
        moves: [{ move: { name: "tackle" }, version_group_details: [{ version_group: { name: "red-blue" } }] }],
      }),
    };
  }
  throw new Error(`Unexpected API path: ${path}`);
};

const { getMoveInfo, getMoveLearners } = await import("../src/pokeapi/client.js");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const firstLearners = await getMoveLearners("Tackle", "rby");
assert(firstLearners.length === 6, "Expected all mocked Tackle learners.");
assert(maxActiveRequests <= 4, `Expected at most four concurrent requests, saw ${maxActiveRequests}.`);

const countAfterLearners = fetchCount;
const secondLearners = await getMoveLearners("Tackle", "rby");
assert(secondLearners.join(",") === firstLearners.join(","), "Cached learners must match the first result.");
assert(fetchCount === countAfterLearners, "Derived learner results should be reused.");

const beforeConcurrentInfo = fetchCount;
await Promise.all([getMoveInfo("Growl"), getMoveInfo("Growl")]);
assert(fetchCount === beforeConcurrentInfo + 1, "Concurrent move detail requests should share one fetch.");

console.log("Validated bounded learner concurrency, learner result caching, and concurrent detail deduplication.");
