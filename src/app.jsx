import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadHomeData } from "./data/loadData";
import { normalizeData, gameGenerations } from "./data/normalize";
import {
  getAbilityInfo,
  getMoveInfo,
  getMoveLearners,
  getPokemonSprite,
} from "./pokeapi/client";
import "./app.css";

const STORAGE_KEY = "home-helper:completed";
const categories = [
  "pokemon",
  "move",
  "ability",
  "ribbon",
  "gift",
  "shiny",
  "special",
];
const gameIcons = {
  rby: [1, "red.png", "blue.png", "yellow.png"],
  gsc: [2, "gold.png", "silver.png", "crystal.png"],
  rse: [3, "emerald.png", "ruby.png", "sapphire.png"],
  frlg: [3, "firered.png", "leafgreen.png"],
  dppt: [4, "diamond.png", "pearl.png", "platinum.png"],
  hgss: [4, "heartgold.png", "soulsilver.png"],
  bw: [5, "black.png", "white.png"],
  b2w2: [5, "black2.png", "white2.png"],
  xy: [6, "x.png", "y.png"],
  oras: [6, "omega-ruby.png", "alpha-sapphire.png"],
  sm: [7, "sun.png", "moon.png"],
  usum: [7, "ultra-sun.png", "ultra-moon.png"],
};

const SHUTDOWN_TIME = new Date("2027-02-25T19:00:00-08:00").getTime();

function useCountdown(targetTime) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, targetTime - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { remaining, days, hours, minutes, seconds };
}

function usePersistentSet() {
  const [completed, setCompleted] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  useEffect(
    () => localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed])),
    [completed],
  );
  return [
    completed,
    (id) =>
      setCompleted((current) => {
        const next = new Set(current);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
  ];
}

function Stat({ label, value, detail }) {
  return (
    <div class="stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Enrichment({ task }) {
  const host = useRef(null);
  const [asset, setAsset] = useState(null);
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (task.category !== "pokemon" && task.category !== "shiny") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      getPokemonSprite(task.name).then(setAsset);
      observer.disconnect();
    }, { rootMargin: "160px" });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [task.id]);
  const loadDetails = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setRequested(true);
    if (task.category === "move") getMoveInfo(task.name).then(setAsset);
    if (task.category === "ability") getAbilityInfo(task.name).then(setAsset);
  };
  if (asset && typeof asset === "string")
    return <span ref={host}><img class="sprite" src={asset} alt="" /></span>;
  if (asset)
    return (
      <small ref={host} class="enrichment">
        {asset.type || asset.description || asset.damageClass}
      </small>
    );
  if (task.category === "move" || task.category === "ability")
    return <button class="enrich-button" type="button" onClick={loadDetails}>{requested ? "Loading..." : "Details"}</button>;
  return <span ref={host} class="enrichment-slot" />;
}

function TaskRow({ task, completed, toggle }) {
  return (
    <label class={`task-row ${completed ? "is-done" : ""}`}>
      <input
        type="checkbox"
        checked={completed}
        onChange={() => toggle(task.id)}
      />
      <span class="task-copy">
        <strong>{task.name}</strong>
      </span>
      <span class="task-meta">
        {task.games.flatMap((code) => {
          const iconData = gameIcons[code];
          if (!iconData) return [];
          return iconData.slice(1).map((filename) => (
            <img
              key={`${code}-${filename}`}
              class="game-icon"
              src={`assets/icons/Generation ${iconData[0]}/${filename}`}
              alt={filename.replace(".png", "")}
              width="48"
              height="48"
            />
          ));
        })}
      </span>
    </label>
  );
}

function Progress({ tasks, completed, games }) {
  const percentage = (items) =>
    items.length
      ? Math.round(
          (items.filter((task) => completed.has(task.id)).length /
            items.length) *
            100,
        )
      : 0;
  const byCategory = categories.map((category) => [
    category,
    tasks.filter((task) => task.category === category),
  ]);
  const byGame = Object.entries(games)
    .map(([code, name]) => [
      code,
      name,
      tasks.filter((task) => task.games.includes(code)),
    ])
    .filter(([, , items]) => items.length);
  return (
    <section class="progress-view">
      <header class="section-heading">
        <p class="eyebrow">Progress report</p>
        <h2>Preservation at a glance</h2>
      </header>
      <div class="progress-grid">
        <Stat
          label="overall complete"
          value={`${percentage(tasks)}%`}
          detail={`${tasks.filter((task) => completed.has(task.id)).length} of ${tasks.length} tasks`}
        />
        {byCategory.map(([category, items]) => (
          <Stat
            key={category}
            label={category}
            value={`${percentage(items)}%`}
            detail={`${items.length} tasks`}
          />
        ))}
      </div>
      <div class="progress-list">
        <h3>By source game</h3>
        {byGame.map(([code, name, items]) => (
          <div class="progress-line" key={code}>
            <span>{name}</span>
            <div>
              <i style={{ width: `${percentage(items)}%` }} />
            </div>
            <b>{percentage(items)}%</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function RibbonView({ groups, tasks, onTaskLink }) {
  return (
    <section class="reference-view">
      <header class="section-heading">
        <p class="eyebrow">Reference library</p>
        <h2>Ribbon atlas</h2>
        <p>
          Acquisition routes, transfer behavior, and the preservation targets
          connected to them.
        </p>
      </header>
      {groups.map((group) => (
        <article class="ribbon-group" key={group.id}>
          <div>
            <span class="tag">
              Gen {group.origin_generation} · {group.category}
            </span>
            <h3>{group.id.replaceAll("_", " ")}</h3>
            <p>{group.acquisition}</p>
            <small>{group.transfer_behavior.replaceAll("_", " ")}</small>
          </div>
          <ul>
            {group.ribbons.map((ribbon) => (
              <li key={ribbon.id}>
                <strong>{ribbon.name}</strong>
                {ribbon.home_title && (
                  <span>HOME title: {ribbon.home_title}</span>
                )}
                {ribbon.requirement && <span>{ribbon.requirement}</span>}
              </li>
            ))}
          </ul>
          {group.linkedTaskIds.length > 0 && (
            <button
              class="text-button"
              onClick={() => onTaskLink(group.linkedTaskIds[0])}
            >
              View linked challenge target ({group.linkedTaskIds.length})
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

function MovesView({ moves, games, completed, toggle, status }) {
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [learners, setLearners] = useState({});
  const gamesWithMoves = Object.entries(games)
    .map(([code, name]) => [
      code,
      name,
      moves.filter(
        (move) =>
          move.games.includes(code) &&
          (status === "all" ||
            (status === "done"
              ? completed.has(`move:${code}:${move.name}`)
              : !completed.has(`move:${code}:${move.name}`))),
      ),
    ])
    .filter(([, , items]) => items.length);
  const expand = (move, code) => {
    const key = `${code}:${move.name}`;
    setExpanded(expanded === key ? null : key);
    if (!details[move.name])
      getMoveInfo(move.name).then((value) =>
        setDetails((current) => ({ ...current, [move.name]: value })),
      );
    if (!learners[key]) {
      setLearners((current) => ({ ...current, [key]: { loading: true } }));
      getMoveLearners(move.name, code).then((value) =>
        setLearners((current) => ({
          ...current,
          [key]: { loading: false, pokemon: value },
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
              <div
                class="move-row game-move-row"
                key={move.name}
              >
                <button
                  class="move-trigger"
                  type="button"
                  onClick={() => expand(move, code)}
                >
                  <strong>{move.name}</strong>
                  {expanded === `${code}:${move.name}` && details[move.name] && (
                    <small>
                      {details[move.name].description ||
                        `${details[move.name].type} · ${details[move.name].damageClass}`}
                    </small>
                  )}
                </button>
                <label class="move-check" onClick={(event) => event.stopPropagation()}>
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
                    ) : learners[`${code}:${move.name}`].pokemon.length ? (
                      <div class="learner-list">
                        {learners[`${code}:${move.name}`].pokemon.map((pokemon) => (
                          <span key={pokemon}>{pokemon.replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`)}</span>
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

export function App() {
  const [model, setModel] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("tracker");
  const [query, setQuery] = useState("");
  const [selectedGames, setSelectedGames] = useState([]);
  const [generation, setGeneration] = useState("all");
  const [status, setStatus] = useState("all");
  const [completed, toggle] = usePersistentSet();

  useEffect(() => {
    loadHomeData()
      .then((data) => setModel(normalizeData(data)))
      .catch((reason) => setError(reason.message));
  }, []);
  const toggleGame = (code) =>
    setSelectedGames((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  const challengeTasks = useMemo(
    () => model?.tasks.filter((task) => task.source === "challenge") || [],
    [model],
  );
  const challengeGameCodes = useMemo(
    () => new Set(challengeTasks.flatMap((task) => task.games)),
    [challengeTasks],
  );
  const exclusivePokemonTasks = useMemo(
    () =>
      model?.tasks.filter(
        (task) =>
          task.source === "exclusive" &&
          (task.category === "pokemon" || task.category === "shiny"),
      ) || [],
    [model],
  );
  const exclusivePokemonGameCodes = useMemo(
    () => new Set(exclusivePokemonTasks.flatMap((task) => task.games)),
    [exclusivePokemonTasks],
  );
  const moveGameCodes = useMemo(
    () => new Set(model?.moveCatalog.flatMap((move) => move.games) || []),
    [model],
  );
  const gameOptions = useMemo(
    () =>
      Object.entries(model?.games || {}).filter(
        ([code]) =>
          (view === "games"
            ? exclusivePokemonGameCodes.has(code)
            : view === "moves"
              ? moveGameCodes.has(code)
              : challengeGameCodes.has(code)) &&
          (generation === "all" || String(gameGenerations[code]) === generation),
      ),
    [model, challengeGameCodes, exclusivePokemonGameCodes, moveGameCodes, generation, view],
  );
  useEffect(() => {
    const allowed = new Set(gameOptions.map(([code]) => code));
    setSelectedGames((current) => current.filter((code) => allowed.has(code)));
  }, [gameOptions]);
  const visibleTasks = useMemo(
    () =>
      challengeTasks.filter((task) => {
        const text =
          `${task.name} ${task.description} ${task.platform || ""}`.toLocaleLowerCase();
        return (
          (!query || text.includes(query.toLocaleLowerCase())) &&
          (selectedGames.length === 0 ||
            task.games.some((code) => selectedGames.includes(code))) &&
          (generation === "all" || String(task.generation) === generation) &&
          (status === "all" ||
            (status === "done"
              ? completed.has(task.id)
              : !completed.has(task.id)))
        );
      }),
    [challengeTasks, query, selectedGames, generation, status, completed],
  );
  const visibleGameTasks = useMemo(
    () =>
      exclusivePokemonTasks.filter((task) => {
        const text =
          `${task.name} ${task.description} ${task.platform || ""}`.toLocaleLowerCase();
        return (
          (!query || text.includes(query.toLocaleLowerCase())) &&
          (selectedGames.length === 0 ||
            task.games.some((code) => selectedGames.includes(code))) &&
          (generation === "all" || String(task.generation) === generation) &&
          (status === "all" ||
            (status === "done"
              ? completed.has(task.id)
              : !completed.has(task.id)))
        );
      }),
    [exclusivePokemonTasks, query, selectedGames, generation, status, completed],
  );
  const visibleMoves = useMemo(
    () =>
      (model?.moveCatalog || []).filter((move) => {
        const text = move.name.toLocaleLowerCase();
        return (
          (!query || text.includes(query.toLocaleLowerCase())) &&
          (selectedGames.length === 0 ||
            move.games.some((code) => selectedGames.includes(code))) &&
          (generation === "all" || move.generations?.includes(Number(generation)))
        );
      }),
    [model, query, selectedGames, generation],
  );
  const countdown = useCountdown(SHUTDOWN_TIME);
  const linkToTask = (id) => {
    setView("tracker");
    setQuery(model.tasks.find((task) => task.id === id)?.name || "");
  };

  if (error)
    return (
      <main class="shell">
        <div class="error">
          <h1>Home Helper could not load its catalog.</h1>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      </main>
    );
  if (!model)
    return (
      <main class="shell loading">
        <span class="loader" />
        <p>Loading the preservation catalog...</p>
      </main>
    );
  return (
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Pokémon HOME · Bank sunset planner</p>
          <h1>Home Helper</h1>
        </div>
        <div class="headline-stat">
          <strong>
            {countdown.remaining > 0
              ? `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}:${String(countdown.minutes).padStart(2, "0")}:${String(countdown.seconds).padStart(2, "0")}`
              : "Bank is closed"}
          </strong>
          <span>until Bank shuts down</span>
        </div>
      </header>
      <nav class="tabs" aria-label="Views">
          {[
        ["tracker", "Challenges"],
          ["games", "Pokémon"],
          ["ribbons", "Ribbons"],
          ["moves", "Moves"],
          ["progress", "Progress"],
        ].map(([key, label]) => (
          <button
            class={view === key ? "active" : ""}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {(view === "tracker" || view === "games" || view === "moves") && (
        <section class="filters">
          <input
            class="search"
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search names, descriptions, moves..."
          />
          <select
            value={generation}
            onChange={(event) => setGeneration(event.currentTarget.value)}
          >
            <option value="all">All generations</option>
            {[1, 2, 3, 4, 5, 6, 7].map((item) => (
              <option value={item}>Generation {item}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value)}
          >
            <option value="all">All status</option>
            <option value="todo">To do</option>
            <option value="done">Complete</option>
          </select>
          <div class="game-filter">
            {gameOptions.map(([code, name]) => (
              <button
                key={code}
                type="button"
                class={`tag ${selectedGames.includes(code) ? "active" : ""}`}
                onClick={() => toggleGame(code)}
              >
                {name}
              </button>
            ))}
          </div>
        </section>
      )}
      {view === "tracker" && (
        <section class="task-list">
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              completed={completed.has(task.id)}
              toggle={toggle}
            />
          ))}
        </section>
      )}
      {view === "games" && (
        <section class="game-view">
          {Object.entries(model.games).map(([code, name]) => {
            const items = visibleGameTasks.filter((task) =>
              task.games.includes(code),
            );
            if (!items.length) return null;
            return (
              <article class="game-group" key={code}>
                <div class="game-title">
                  <div>
                    <h2>{name}</h2>
                  </div>
                  <span>
                    {items.filter((task) => completed.has(task.id)).length}/
                    {items.length}
                  </span>
                </div>
                {items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    completed={completed.has(task.id)}
                    toggle={toggle}
                    games={model.games}
                  />
                ))}
              </article>
            );
          })}
        </section>
      )}
      {view === "ribbons" && (
        <RibbonView
          groups={model.ribbonGroups}
          tasks={model.tasks}
          onTaskLink={linkToTask}
        />
      )}
      {view === "moves" && (
        <MovesView
          moves={visibleMoves}
          games={model.games}
          completed={completed}
          toggle={toggle}
          status={status}
        />
      )}
      {view === "progress" && (
        <Progress
          tasks={model.tasks}
          completed={completed}
          games={model.games}
        />
      )}
    </main>
  );
}
