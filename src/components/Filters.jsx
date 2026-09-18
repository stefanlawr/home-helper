const GENERATIONS = [1, 2, 3, 4, 5, 6, 7];

export function Filters({
  query,
  setQuery,
  generation,
  setGeneration,
  status,
  setStatus,
  gameOptions,
  selectedGames,
  toggleGame,
}) {
  return (
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
        {GENERATIONS.map((item) => (
          <option key={item} value={item}>
            Generation {item}
          </option>
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
  );
}
