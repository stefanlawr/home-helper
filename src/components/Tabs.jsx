const tabs = [
  ["tracker", "Challenges"],
  ["games", "Exclusive Pokémon"],
  ["ribbons", "Ribbons"],
  ["moves", "Moves"],
  ["progress", "Progress"],
];

export function Tabs({ view, setView }) {
  return (
    <nav class="tabs" aria-label="Views">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          class={view === key ? "active" : ""}
          onClick={() => setView(key)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
