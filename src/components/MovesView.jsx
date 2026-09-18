import { useState } from "preact/hooks";
import { getMoveInfo, getMoveLearners } from "../pokeapi/client";

function formatPokemonName(name) {
  return name.replace(
    /(^|-)([a-z])/g,
    (_, separator, letter) => `${separator}${letter.toUpperCase()}`,
  );
}

function describeMove(details) {
  if (details.error) {
    return details.error;
  }
  const { description, type, damageClass } = details.value;
  return description || `${type} · ${damageClass}`;
}

function MoveLearners({ learners }) {
  let content;
  if (learners.loading) {
    content = <small>Loading Pokemon...</small>;
  } else if (learners.error) {
    content = <small>{learners.error}</small>;
  } else if (learners.pokemon.length) {
    content = (
      <div class="learner-list">
        {learners.pokemon.map((pokemon) => (
          <span key={pokemon}>{formatPokemonName(pokemon)}</span>
        ))}
      </div>
    );
  } else {
    content = <small>No Pokemon found for this game.</small>;
  }
  return (
    <div class="move-learners">
      <strong>Pokemon that can learn this move</strong>
      <small>
        In any game, limited to Pokémon and forms from this generation or
        earlier.
      </small>
      {content}
    </div>
  );
}

function MoveRow({
  move,
  expanded,
  details,
  learners,
  onExpand,
  done,
  toggle,
}) {
  return (
    <div class="move-row game-move-row">
      <button class="move-trigger" type="button" onClick={onExpand}>
        <strong>{move.name}</strong>
        {expanded && details && <small>{describeMove(details)}</small>}
      </button>
      <label class="move-check">
        <input
          type="checkbox"
          checked={done}
          onChange={() => toggle(move.id)}
        />
      </label>
      <span class="move-status">Removed · {move.removedIn}</span>
      {expanded && learners && <MoveLearners learners={learners} />}
    </div>
  );
}

export function MovesView({ games, movesByGame, completed, toggle }) {
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [learners, setLearners] = useState({});

  const expand = (move, code) => {
    const key = `${code}:${move.name}`;
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    if (!details[move.name] || details[move.name].error) {
      getMoveInfo(move.name)
        .then((value) =>
          setDetails((current) => ({ ...current, [move.name]: { value } })),
        )
        .catch(() =>
          setDetails((current) => ({
            ...current,
            [move.name]: { error: "Unable to load move details." },
          })),
        );
    }
    if (!learners[key] || learners[key].error) {
      setLearners((current) => ({
        ...current,
        [key]: { loading: true, pokemon: [], error: null },
      }));
      getMoveLearners(move.name, code)
        .then((value) =>
          setLearners((current) => ({
            ...current,
            [key]: { loading: false, pokemon: value, error: null },
          })),
        )
        .catch(() =>
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
        {games.map(([code, name]) => {
          const moves = movesByGame.get(code);
          if (!moves) {
            return null;
          }
          return (
            <article class="game-group" key={code}>
              <div class="game-title">
                <div>
                  <h2>{name}</h2>
                </div>
                <span>{moves.length} moves</span>
              </div>
              {moves.map((move) => {
                const key = `${code}:${move.name}`;
                return (
                  <MoveRow
                    key={move.name}
                    move={move}
                    expanded={expanded === key}
                    details={details[move.name]}
                    learners={learners[key]}
                    onExpand={() => expand(move, code)}
                    done={completed.has(move.id)}
                    toggle={toggle}
                  />
                );
              })}
            </article>
          );
        })}
      </div>
    </section>
  );
}
