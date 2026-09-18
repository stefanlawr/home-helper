import { gameGenerations } from "../data/normalize.js";

const TTL = 1000 * 60 * 60 * 24 * 30;
const prefix = "home-helper:pokeapi:v2:";
const legacyPrefix = "home-helper:pokeapi:";
const pending = new Map();
// Highest National Dex number introduced by each generation, in order.
const generationDexLimits = [151, 251, 386, 493, 649, 721, 809];
// PokeAPI numbers alternate forms (Alolan, Mega, ...) from here instead of by species.
const FORM_ID_START = 10000;
// Forms introduced after their base species; any other form counts from its species' generation.
const laterForms = [
  [/-(mega|primal)(-|$)|-(cosplay|rock-star|belle|pop-star|phd|libre)$/, 6],
  [/-(alola|totem)(-|$)|-cap$|-(ash|battle-bond)$/, 7],
  [/-(galar|gmax)(-|$)|-hisui(-|$)/, 8],
  [/-paldea(-|$)/, 9],
];

function slug(value) {
  return value
    .toLocaleLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function englishEntry(entries) {
  return entries?.find((entry) => entry.language?.name === "en");
}

function dexNumber(url) {
  return Number(url?.match(/\/(\d+)\/?$/)?.[1]) || null;
}

// Drops expired entries and the raw responses cached by earlier versions, which could fill the storage quota.
function pruneStorage() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(legacyPrefix)) {
        continue;
      }
      let expired = !key.startsWith(prefix);
      if (!expired) {
        try {
          expired = !(
            JSON.parse(localStorage.getItem(key))?.expiresAt > Date.now()
          );
        } catch {
          expired = true;
        }
      }
      if (expired) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be unavailable (private mode, blocked cookies).
  }
}

pruneStorage();

// Fetches a PokeAPI resource and caches only the value `pick` derives from it.
// Rejects on failure so callers can show an error and retry.
function cached(path, pick) {
  const key = `${prefix}${path}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && saved.expiresAt > Date.now()) {
      return Promise.resolve(saved.value);
    }
  } catch {
    // Ignore malformed cache entries.
  }

  if (pending.has(path)) {
    return pending.get(path);
  }

  const request = fetch(`https://pokeapi.co/api/v2/${path}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`PokeAPI ${path} returned ${response.status}`);
      }
      const value = pick(await response.json());
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ value, expiresAt: Date.now() + TTL }),
        );
      } catch {
        // Ignore storage quota issues.
      }
      return value;
    })
    .finally(() => pending.delete(path));

  pending.set(path, request);
  return request;
}

function getMove(name) {
  return cached(`move/${slug(name)}`, (move) => ({
    type: move.type?.name,
    damageClass: move.damage_class?.name,
    description: englishEntry(move.flavor_text_entries)?.flavor_text?.replace(
      /\s+/g,
      " ",
    ),
    learners: (move.learned_by_pokemon || []).map((entry) => [
      entry.name,
      dexNumber(entry.url),
    ]),
  }));
}

export function getMoveInfo(name) {
  return getMove(name).then(({ type, damageClass, description }) => ({
    type,
    damageClass,
    description,
  }));
}

function dexGeneration(number) {
  const index = generationDexLimits.findIndex((limit) => number <= limit);
  return index === -1 ? Infinity : index + 1;
}

// Generation a learner first appeared in; forms resolve through the longest learner name
// they extend ("raticate-totem-alola" -> "raticate"), and are excluded when none matches.
function learnerGeneration(name, number, speciesDex) {
  if (number < FORM_ID_START) {
    return dexGeneration(number);
  }
  const parts = name.split("-");
  for (let length = parts.length - 1; length > 0; length -= 1) {
    const speciesNumber = speciesDex.get(parts.slice(0, length).join("-"));
    if (speciesNumber) {
      const formGeneration =
        laterForms.find(([pattern]) => pattern.test(name))?.[1] || 0;
      return Math.max(dexGeneration(speciesNumber), formGeneration);
    }
  }
  return Infinity;
}

// PokeAPI only lists learners per version group on each Pokémon's record, which is too heavy to fetch
// for every learner. Instead, list every Pokémon that learns the move in any game, limited to species
// and forms that existed by the game's generation.
export function getMoveLearners(name, gameCode) {
  const generation = gameGenerations[gameCode] || Infinity;
  return getMove(name).then(({ learners }) => {
    // Index each species under its name and shorter prefixes, since some default forms carry a
    // suffix too ("deoxys-normal" must resolve "deoxys-attack").
    const speciesDex = new Map();
    for (const [pokemon, number] of learners) {
      if (!number || number >= FORM_ID_START) {
        continue;
      }
      const parts = pokemon.split("-");
      for (let length = parts.length; length > 0; length -= 1) {
        const key = parts.slice(0, length).join("-");
        if (!speciesDex.has(key)) {
          speciesDex.set(key, number);
        }
      }
    }
    return learners
      .filter(
        ([pokemon, number]) =>
          number &&
          learnerGeneration(pokemon, number, speciesDex) <= generation,
      )
      .map(([pokemon]) => pokemon)
      .sort();
  });
}
