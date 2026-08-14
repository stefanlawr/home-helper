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
  colosseum: [3, "colosseum.png"],
  "dream-radar": [5, "dream-radar.png"],
};

export function TaskRow({ task, completed, toggle }) {
  return (
    <label class={`task-row ${completed ? "is-done" : ""}`}>
      <input
        type="checkbox"
        checked={completed}
        onChange={() => toggle(task.id)}
      />
      <span class="task-copy">
        <strong>{task.name}</strong>
        {task.description &&
          task.description.split("\n").map((line, index) => (
            <small key={index}>{line}</small>
          ))}
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
