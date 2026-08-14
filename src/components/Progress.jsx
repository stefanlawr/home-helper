const categories = [
  "pokemon",
  "move",
  "ability",
  "ribbon",
  "gift",
  "shiny",
  "special",
];

function Stat({ label, value, detail }) {
  return (
    <div class="stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function Progress({ tasks, completed, games }) {
  const categoryCounts = new Map(categories.map((category) => [category, { total: 0, done: 0 }]));
  const gameCounts = new Map(Object.keys(games).map((code) => [code, { total: 0, done: 0 }]));
  let completedCount = 0;
  for (const task of tasks) {
    const done = completed.has(task.id);
    if (done) completedCount += 1;
    const category = categoryCounts.get(task.category);
    if (category) {
      category.total += 1;
      if (done) category.done += 1;
    }
    for (const code of task.games) {
      const game = gameCounts.get(code);
      if (!game) continue;
      game.total += 1;
      if (done) game.done += 1;
    }
  }
  const percentage = (total, done) =>
    total ? Math.round((done / total) * 100) : 0;
  const byCategory = categories
    .map((category) => [category, categoryCounts.get(category)])
    .filter(([, counts]) => counts.total);
  const byGame = Object.entries(games)
    .map(([code, name]) => [code, name, gameCounts.get(code)])
    .filter(([, , counts]) => counts.total);
  return (
    <section class="progress-view">
      <header class="section-heading">
        <p class="eyebrow">Progress report</p>
        <h2>Preservation at a glance</h2>
      </header>
      <div class="progress-grid">
        <Stat
          label="overall complete"
          value={`${percentage(tasks.length, completedCount)}%`}
          detail={`${completedCount} of ${tasks.length} tasks`}
        />
        {byCategory.map(([category, counts]) => (
          <Stat
            key={category}
            label={category}
            value={`${percentage(counts.total, counts.done)}%`}
            detail={`${counts.done} of ${counts.total} tasks`}
          />
        ))}
      </div>
      <div class="progress-list">
        <h3>By source game</h3>
        {byGame.map(([code, name, counts]) => (
          <div class="progress-line" key={code}>
            <span>{name}</span>
            <div>
              <i style={{ width: `${percentage(counts.total, counts.done)}%` }} />
            </div>
            <b>{percentage(counts.total, counts.done)}%</b>
          </div>
        ))}
      </div>
    </section>
  );
}
