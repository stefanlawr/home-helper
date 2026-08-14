import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadHomeData } from "./data/loadData";
import { normalizeData } from "./data/normalize";
import {
  getAbilityInfo,
  getMoveInfo,
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
        <small>{task.platform || task.description}</small>
      </span>
      <span class="task-meta">
        <b>{task.category}</b>
        {task.priority && <em>priority</em>}
        <Enrichment task={task} />
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
              View linked checklist target ({group.linkedTaskIds.length})
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

function MovesView({ moves }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const visible = moves.filter((move) =>
    move.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const expand = (move) => {
    setExpanded(expanded === move.name ? null : move.name);
    if (!details[move.name])
      getMoveInfo(move.name).then((value) =>
        setDetails((current) => ({ ...current, [move.name]: value })),
      );
  };
  return (
    <section class="reference-view">
      <header class="section-heading">
        <p class="eyebrow">Reference library</p>
        <h2>Move availability</h2>
        <p>
          Generation legality from the local catalog, with removed moves flagged
          for preservation.
        </p>
        <input
          class="search large"
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search moves"
        />
      </header>
      <div class="move-table">
        <div class="move-header">
          <span>Move</span>
          <span>Generations</span>
          <span>Status</span>
        </div>
        {visible.map((move) => (
          <button class="move-row" key={move.name} onClick={() => expand(move)}>
            <span>
              <strong>{move.name}</strong>
              {expanded === move.name && details[move.name] && (
                <small>
                  {details[move.name].description ||
                    `${details[move.name].type} · ${details[move.name].damageClass}`}
                </small>
              )}
            </span>
            <span>{move.generations.join(", ")}</span>
            <span>
              {move.removedIn ? `Removed · ${move.removedIn}` : "Available"}
            </span>
          </button>
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
  const [game, setGame] = useState("all");
  const [generation, setGeneration] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [completed, toggle] = usePersistentSet();

  useEffect(() => {
    loadHomeData()
      .then((data) => setModel(normalizeData(data)))
      .catch((reason) => setError(reason.message));
  }, []);
  const visibleTasks = useMemo(
    () =>
      model?.tasks.filter((task) => {
        const text =
          `${task.name} ${task.description} ${task.platform || ""}`.toLocaleLowerCase();
        return (
          (!query || text.includes(query.toLocaleLowerCase())) &&
          (game === "all" || task.games.includes(game)) &&
          (generation === "all" || String(task.generation) === generation) &&
          (category === "all" || task.category === category) &&
          (status === "all" ||
            (status === "done"
              ? completed.has(task.id)
              : !completed.has(task.id)))
        );
      }) || [],
    [model, query, game, generation, category, status, completed],
  );
  const doneCount =
    model?.tasks.filter((task) => completed.has(task.id)).length || 0;
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
          <strong>{doneCount}</strong>
          <span>targets secured</span>
        </div>
      </header>
      <nav class="tabs" aria-label="Views">
        {[
          ["tracker", "Checklist"],
          ["games", "By game"],
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
      {(view === "tracker" || view === "games") && (
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
              <option value={item}>Generation {item}</option>
            ))}
          </select>
          <select
            value={game}
            onChange={(event) => setGame(event.currentTarget.value)}
          >
            <option value="all">All source games</option>
            {Object.entries(model.games).map(([code, name]) => (
              <option value={code}>{name}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value)}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option value={item}>{item}</option>
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
        </section>
      )}
      {view === "tracker" && (
        <section class="task-list">
          <div class="list-heading">
            <div>
              <p class="eyebrow">Unified checklist</p>
              <h2>What still needs preserving</h2>
            </div>
            <span>
              {visibleTasks.length} shown · {model.tasks.length} total
            </span>
          </div>
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
            const items = visibleTasks.filter((task) =>
              task.games.includes(code),
            );
            if (!items.length) return null;
            return (
              <article class="game-group" key={code}>
                <div class="game-title">
                  <div>
                    <span class="tag">{code}</span>
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
      {view === "moves" && <MovesView moves={model.moveCatalog} />}
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
