import { useEffect, useMemo, useState } from "preact/hooks";
import { gameGenerations } from "./data/normalize";
import { useCatalog } from "./data/useCatalog";
import { createTaskFilter, groupByGame } from "./data/filters";
import { tradeViewKey } from "./data/keys";
import { usePersistentSet } from "./hooks";
import { TaskRow } from "./components/TaskRow";
import { Progress } from "./components/Progress";
import { RibbonView } from "./components/RibbonView";
import { MovesView } from "./components/MovesView";
import { Filters } from "./components/Filters";
import { GameGroup } from "./components/GameGroup";
import { Tabs } from "./components/Tabs";
import { Countdown } from "./components/Countdown";
import "./app.css";

const SHUTDOWN_TIME = new Date("2027-02-25T19:00:00-08:00").getTime();
const EMPTY = [];

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

  const isTradeView = view.startsWith("trade:");
  const showFilters =
    isTradeView || view === "tracker" || view === "games" || view === "moves";

  // One tab per trade category, keyed by view name.
  const tradeTabs = useMemo(() => {
    const tabs = new Map();
    for (const task of model?.tasksBySource.trade || EMPTY) {
      const key = tradeViewKey(task.category);
      if (!tabs.has(key)) {
        tabs.set(key, task.category);
      }
    }
    return tabs;
  }, [model]);

  // The tasks the current view lists; views without their own list fall back to challenges.
  const viewTasks = useMemo(() => {
    if (!model) {
      return EMPTY;
    }
    if (view === "games") {
      return model.tasksBySource.exclusive || EMPTY;
    }
    if (view === "moves") {
      return model.moveCatalog;
    }
    if (isTradeView) {
      return (model.tasksBySource.trade || EMPTY).filter(
        (task) => tradeViewKey(task.category) === view,
      );
    }
    return model.tasksBySource.challenge || EMPTY;
  }, [model, view, isTradeView]);

  const gameOptions = useMemo(() => {
    const codes = new Set(viewTasks.flatMap((task) => task.games));
    return Object.entries(model?.games || {}).filter(
      ([code]) =>
        codes.has(code) &&
        (generation === "all" || String(gameGenerations[code]) === generation),
    );
  }, [model, viewTasks, generation]);
  useEffect(() => {
    const allowed = new Set(gameOptions.map(([code]) => code));
    setSelectedGames((current) => current.filter((code) => allowed.has(code)));
  }, [gameOptions]);
  const visibleGames = useMemo(
    () =>
      selectedGames.length
        ? gameOptions.filter(([code]) => selectedGames.includes(code))
        : gameOptions,
    [gameOptions, selectedGames],
  );

  const taskFilter = useMemo(
    () =>
      createTaskFilter({ query, selectedGames, generation, status, completed }),
    [query, selectedGames, generation, status, completed],
  );
  const visibleTasks = useMemo(
    () => viewTasks.filter(taskFilter),
    [viewTasks, taskFilter],
  );
  const visibleTasksByGame = useMemo(
    () => groupByGame(visibleTasks),
    [visibleTasks],
  );
  const visibleProgressTasks = useMemo(
    () =>
      view === "progress" && model
        ? model.progressTasks.filter(taskFilter)
        : EMPTY,
    [view, model, taskFilter],
  );

  if (error) {
    return (
      <main class="shell">
        <div class="error">
          <h1>Home Helper could not load its catalog.</h1>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      </main>
    );
  }
  if (!model) {
    return (
      <main class="shell loading">
        <span class="loader" />
        <p>Loading the preservation catalog...</p>
      </main>
    );
  }
  return (
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Pokémon HOME · Bank sunset planner</p>
          <h1>Home Helper</h1>
        </div>
        <Countdown targetTime={SHUTDOWN_TIME} />
      </header>
      <Tabs view={view} setView={setView} extraTabs={[...tradeTabs]} />
      {showFilters && (
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
      {(view === "games" || isTradeView) && (
        <section class="game-view">
          {visibleGames.map(([code, name]) => (
            <GameGroup
              key={code}
              name={name}
              tasks={visibleTasksByGame.get(code) || EMPTY}
              completed={completed}
              toggle={toggle}
            />
          ))}
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
          games={visibleGames}
          movesByGame={visibleTasksByGame}
          completed={completed}
          toggle={toggle}
        />
      )}
      {view === "progress" && (
        <Progress
          tasks={visibleProgressTasks}
          completed={completed}
          games={model.games}
        />
      )}
    </main>
  );
}
