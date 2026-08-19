const baseTabs = [
  ["tracker", "Challenges"],
  ["games", "Exclusive Pokémon"],
  ["trades", "Trades & Gifts"],
  ["ribbons", "Ribbons"],
  ["moves", "Moves"],
  ["progress", "Progress"],
];

function tradeViewKey(category) {
  return `trade:${String(category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function Tabs({ view, setView, tradeCategories = [] }) {
  const categoryTabs = tradeCategories.map((category) => [
    tradeViewKey(category),
    category,
  ]);

  return (
    <nav class="tabs" aria-label="Views">
      {[...baseTabs, ...categoryTabs].map(([key, label]) => (
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
