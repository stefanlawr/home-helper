import { useEffect, useState } from "preact/hooks";

const STORAGE_KEY = "home-helper:completed";

export function useCountdown(targetTime) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, targetTime - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { remaining, days, hours, minutes, seconds };
}

export function usePersistentSet() {
  const [completed, setCompleted] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  useEffect(
    () => localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed])),
    [completed],
  );
  return [
    completed,
    (id) =>
      setCompleted((current) => {
        const next = new Set(current);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
  ];
}
