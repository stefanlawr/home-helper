// Builds one predicate for every task-like item (challenges, exclusives, trades, moves, ribbons),
// doing the per-filter work once instead of once per item.
export function createTaskFilter({
  query,
  selectedGames,
  generation,
  status,
  completed,
}) {
  const needle = query.toLocaleLowerCase();
  const games = new Set(selectedGames);
  const generationNumber = Number(generation);
  return (task) =>
    (!needle || task.searchText.includes(needle)) &&
    (games.size === 0 || task.games.some((code) => games.has(code))) &&
    (generation === "all" ||
      (task.generations
        ? task.generations.includes(generationNumber)
        : task.generation === generationNumber)) &&
    (status === "all" || completed.has(task.id) === (status === "done"));
}

export function groupByGame(items) {
  const groups = new Map();
  for (const item of items) {
    for (const code of item.games) {
      const group = groups.get(code);
      if (group) {
        group.push(item);
      } else {
        groups.set(code, [item]);
      }
    }
  }
  return groups;
}
