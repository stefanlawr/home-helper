function matchesStatus(id, status, completed) {
  if (status === "all") return true
  const isComplete = completed.has(id)
  return status === "done" ? isComplete : !isComplete
}

function matchesGames(games, selectedGames) {
  return selectedGames.length === 0 || games.some((code) => selectedGames.includes(code))
}

export function matchesTask(task, filters) {
  const query = filters.query.toLocaleLowerCase()
  const text = `${task.name} ${task.description} ${task.platform || ""}`.toLocaleLowerCase()
  return (
    (!query || text.includes(query)) &&
    matchesGames(task.games, filters.selectedGames) &&
    (filters.generation === "all" || String(task.generation) === filters.generation) &&
    matchesStatus(task.id, filters.status, filters.completed)
  )
}

export function matchesMove(move, filters) {
  const query = filters.query.toLocaleLowerCase()
  return (
    (!query || move.name.toLocaleLowerCase().includes(query)) &&
    matchesGames(move.games, filters.selectedGames) &&
    (filters.generation === "all" || move.generations?.includes(Number(filters.generation)))
  )
}
