const baseTabs = [
  ["tracker", "Challenges"],
  ["games", "Exclusive Pokémon"],
  ["ribbons", "Ribbons"],
  ["moves", "Moves"],
  ["progress", "Progress"],
];

export function Tabs({ view, setView, extraTabs = [] }) {
  return (
    <nav class="tabs" aria-label="Views">
      {[...baseTabs, ...extraTabs].map(([key, label]) => (
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
