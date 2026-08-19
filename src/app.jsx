import { useEffect, useMemo, useState } from "preact/hooks";
import { gameGenerations } from "./data/normalize";
import { useCatalog } from "./data/useCatalog";
import { matchesMove, matchesTask } from "./data/filters";
import { useCountdown, usePersistentSet } from "./hooks";
import { TaskRow } from "./components/TaskRow";
import { Progress } from "./components/Progress";
import { RibbonView } from "./components/RibbonView";
import { MovesView } from "./components/MovesView";
import { Filters } from "./components/Filters";
import { GameGroup } from "./components/GameGroup";
import { Tabs } from "./components/Tabs";
import "./app.css";

const SHUTDOWN_TIME = new Date("2027-02-25T19:00:00-08:00").getTime();

export function App() {
  const { model, error } = useCatalog();
  const [view, setView] = useState("tracker");
  const [query, setQuery] = useState("");
  const [selectedGames, setSelectedGames] = useState([]);
  const [generation, setGeneration] = useState("all");
  const [status, setStatus] = useState("all");
  const [completed, toggle] = usePersistentSet();

  const toggleGame = (code) =>
    setSelectedGames((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  const challengeTasks = useMemo(
    () => model?.taskIndex.bySource.challenge || [],
    [model],
  );
  const challengeGameCodes = useMemo(
    () => new Set(challengeTasks.flatMap((task) => task.games)),
    [challengeTasks],
  );
  const exclusivePokemonTasks = useMemo(
    () =>
      (model?.taskIndex.bySource.exclusive || []).filter(
        (task) =>
          (task.category === "pokemon" || task.category === "shiny"),
      ) || [],
    [model],
  );
  const exclusivePokemonGameCodes = useMemo(
    () => new Set(exclusivePokemonTasks.flatMap((task) => task.games)),
    [exclusivePokemonTasks],
  );
  const moveGameCodes = useMemo(
    () => new Set(Object.keys(model?.moveIndex.byGame || {})),
    [model],
  );
  const tradeTasks = useMemo(
    () => model?.taskIndex.bySource.trade || [],
    [model],
  );
  const normalizeCategoryKey = (category) => String(category || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const tradeCategories = useMemo(() => {
    const categories = new Map();
    for (const task of tradeTasks) {
      const category = String(task.category || "").trim();
      if (!category) continue;
      const key = normalizeCategoryKey(category);
      if (!categories.has(key)) categories.set(key, category);
    }
    return [...categories.values()];
  }, [tradeTasks]);
  const tradeGameCodes = useMemo(
    () => new Set(tradeTasks.flatMap((task) => task.games)),
    [tradeTasks],
  );
  const activeTradeCategory = useMemo(
    () => tradeCategories.find((category) => view === `trade:${normalizeCategoryKey(category)}`) || null,
    [tradeCategories, view],
  );
  const activeTradeTasks = useMemo(
    () => (activeTradeCategory ? tradeTasks.filter((task) => task.category === activeTradeCategory) : tradeTasks),
    [activeTradeCategory, tradeTasks],
  );
  const activeTradeGameCodes = useMemo(
    () => new Set(activeTradeTasks.flatMap((task) => task.games)),
    [activeTradeTasks],
  );
  const gameOptions = useMemo(
    () =>
      Object.entries(model?.games || {}).filter(
        ([code]) =>
          (view === "games"
            ? exclusivePokemonGameCodes.has(code)
            : view === "moves"
              ? moveGameCodes.has(code)
              : view === "trades" || view.startsWith("trade:")
                ? (view === "trades" ? tradeGameCodes : activeTradeGameCodes).has(code)
                : challengeGameCodes.has(code)) &&
          (generation === "all" || String(gameGenerations[code]) === generation),
      ),
    [model, challengeGameCodes, exclusivePokemonGameCodes, moveGameCodes, tradeGameCodes, activeTradeGameCodes, generation, view],
  );
  useEffect(() => {
    const allowed = new Set(gameOptions.map(([code]) => code));
    setSelectedGames((current) => current.filter((code) => allowed.has(code)));
  }, [gameOptions]);
  const visibleTasks = useMemo(
    () => challengeTasks.filter((task) => matchesTask(task, {
      query,
      selectedGames,
      generation,
      status,
      completed,
    })),
    [challengeTasks, query, selectedGames, generation, status, completed],
  );
  const visibleGameTasks = useMemo(
    () => exclusivePokemonTasks.filter((task) => matchesTask(task, {
      query,
      selectedGames,
      generation,
      status,
      completed,
    })),
    [exclusivePokemonTasks, query, selectedGames, generation, status, completed],
  );
  const visibleGameTasksByCode = useMemo(() => {
    const groups = new Map();
    for (const task of visibleGameTasks) {
      for (const code of task.games) {
        const items = groups.get(code) || [];
        items.push(task);
        groups.set(code, items);
      }
    }
    return groups;
  }, [visibleGameTasks]);
  const visibleTradeTasks = useMemo(
    () =>
      (view === "trades" || !view.startsWith("trade:") ? tradeTasks : tradeTasks.filter((task) => task.category === activeTradeCategory))
        .filter((task) => matchesTask(task, {
          query,
          selectedGames,
          generation,
          status,
          completed,
        })),
    [tradeTasks, activeTradeCategory, view, query, selectedGames, generation, status, completed],
  );
  const visibleTradeTasksByCode = useMemo(() => {
    const groups = new Map();
    for (const task of visibleTradeTasks) {
      for (const code of task.games) {
        const items = groups.get(code) || [];
        items.push(task);
        groups.set(code, items);
      }
    }
    return groups;
  }, [visibleTradeTasks]);
  const visibleMoves = useMemo(
    () => (model?.moveCatalog || []).filter((move) => matchesMove(move, {
      query,
      selectedGames,
      generation,
    })),
    [model, query, selectedGames, generation],
  );
  const progressTasks = useMemo(
    () => [
      ...challengeTasks,
      ...exclusivePokemonTasks.filter(
        (task) => task.generation >= 1 && task.generation <= 7,
      ),
      ...tradeTasks,
      ...(model?.moveCatalog || []).map((move) => ({
        id: `move:${move.name}`,
        category: "move",
        games: move.games,
      })),
      ...(model?.ribbonGroups || [])
        .filter((group) => group.origin_generation >= 1 && group.origin_generation <= 7)
        .flatMap((group) => group.ribbons.map((ribbon) => ({
          id: `ribbon:${group.id}:${ribbon.id}`,
          category: "ribbon",
          games: group.origin_games.filter((code) => gameGenerations[code] <= 7),
        }))),
    ],
    [challengeTasks, exclusivePokemonTasks, tradeTasks, model],
  );
  const countdown = useCountdown(SHUTDOWN_TIME);
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
      <Tabs view={view} setView={setView} tradeCategories={tradeCategories} />
      {(view === "tracker" || view === "games" || view === "trades" || view.startsWith("trade:") || view === "moves") && (
        <Filters
          query={query}
          setQuery={setQuery}
          generation={generation}
          setGeneration={setGeneration}
          status={status}
          setStatus={setStatus}
          gameOptions={gameOptions}
          selectedGames={selectedGames}
          toggleGame={toggleGame}
        />
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
            const items = visibleGameTasksByCode.get(code) || [];
            return <GameGroup key={code} name={name} tasks={items} completed={completed} toggle={toggle} />;
          })}
        </section>
      )}
      {(view === "trades" || view.startsWith("trade:")) && (
        <section class="game-view">
          {Object.entries(model.games).map(([code, name]) => {
            const items = visibleTradeTasksByCode.get(code) || [];
            return <GameGroup key={code} name={name} tasks={items} completed={completed} toggle={toggle} />;
          })}
        </section>
      )}
      {view === "ribbons" && (
        <RibbonView
          groups={model.ribbonGroups}
          completed={completed}
          toggle={toggle}
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
          tasks={progressTasks}
          completed={completed}
          games={model.games}
        />
      )}
    </main>
  );
}
