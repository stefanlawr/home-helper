// Accents are folded so "Gift Pokémon" becomes "gift-pokemon" rather than "gift-pok-mon".
export function categoryKey(category) {
  return String(category || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function tradeViewKey(category) {
  return `trade:${categoryKey(category)}`;
}

// Completion IDs are persisted in localStorage, so these formats must not change.
export function moveTaskId(name) {
  return `move:${name}`;
}

export function ribbonTaskId(groupId, ribbonId) {
  return `ribbon:${groupId}:${ribbonId}`;
}
