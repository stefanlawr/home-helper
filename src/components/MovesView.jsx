import { useState } from "preact/hooks";
import { getMoveInfo, getMoveLearners } from "../pokeapi/client";

export function MovesView({ moves, games, completed, toggle, status }) {
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [learners, setLearners] = useState({});
  const movesByGame = new Map();
  for (const move of moves) {
    for (const code of move.games) {
      const items = movesByGame.get(code) || [];
      if (
        status === "all" ||
        (status === "done"
          ? completed.has(`move:${code}:${move.name}`)
          : !completed.has(`move:${code}:${move.name}`))
      ) {
        items.push(move);
      }
      movesByGame.set(code, items);
    }
  }
  const gamesWithMoves = Object.entries(games)
    .map(([code, name]) => [code, name, movesByGame.get(code) || []])
    .filter(([, , items]) => items.length);
  const expand = (move, code) => {
    const key = `${code}:${move.name}`;
    setExpanded(expanded === key ? null : key);
    if (!details[move.name])
      getMoveInfo(move.name).then((value) =>
        setDetails((current) => ({ ...current, [move.name]: { value } })),
      ).catch(() =>
        setDetails((current) => ({
          ...current,
          [move.name]: { error: "Unable to load move details." },
        })),
      );
    if (!learners[key] || learners[key].error) {
      setLearners((current) => ({
        ...current,
        [key]: { loading: true, pokemon: [], error: null },
      }));
      getMoveLearners(move.name, code).then((value) =>
        setLearners((current) => ({
          ...current,
          [key]: { loading: false, pokemon: value, error: null },
        })),
      ).catch(() =>
        setLearners((current) => ({
          ...current,
          [key]: {
            loading: false,
            pokemon: [],
            error: "Unable to load Pokemon learners.",
          },
        })),
      );
    }
  };
  return (
    <section class="reference-view">
      <header class="section-heading">
        <p class="eyebrow">Reference library</p>
        <h2>Moves by game</h2>
        <p>
          Moves that can no longer be obtained in current games, grouped by
          their Gen 1–7 source games.
        </p>
      </header>
      <div class="game-view">
        {gamesWithMoves.map(([code, name, items]) => (
          <article class="game-group" key={code}>
            <div class="game-title">
              <div>
                <h2>{name}</h2>
              </div>
              <span>{items.length} moves</span>
            </div>
            {items.map((move) => (
              <div class="move-row game-move-row" key={move.name}>
                <button
                  class="move-trigger"
                  type="button"
                  onClick={() => expand(move, code)}
                >
                  <strong>{move.name}</strong>
                  {expanded === `${code}:${move.name}` && details[move.name] && (
                    <small>
                      {details[move.name].error ||
                        details[move.name].value?.description ||
                        `${details[move.name].value?.type} · ${details[move.name].value?.damageClass}`}
                    </small>
                  )}
                </button>
                <label
                  class="move-check"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={completed.has(`move:${code}:${move.name}`)}
                    onChange={() => toggle(`move:${code}:${move.name}`)}
                  />
                </label>
                <span class="move-status">
                  {move.removedIn ? `Removed · ${move.removedIn}` : "Available"}
                </span>
                {expanded === `${code}:${move.name}` && learners[`${code}:${move.name}`] && (
                  <div class="move-learners">
                    <strong>Pokemon that can learn this move</strong>
                    {learners[`${code}:${move.name}`].loading ? (
                      <small>Loading Pokemon...</small>
                    ) : learners[`${code}:${move.name}`].error ? (
                      <small>{learners[`${code}:${move.name}`].error}</small>
                    ) : learners[`${code}:${move.name}`].pokemon.length ? (
                      <div class="learner-list">
                        {learners[`${code}:${move.name}`].pokemon.map((pokemon) => (
                          <span key={pokemon}>
                            {pokemon.replace(
                              /(^|-)([a-z])/g,
                              (_, separator, letter) => `${separator}${letter.toUpperCase()}`,
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <small>No Pokemon found for this game.</small>
                    )}
                  </div>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
