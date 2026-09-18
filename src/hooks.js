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

function parseSet(value) {
  try {
    return new Set(JSON.parse(value || "[]"));
  } catch {
    return new Set();
  }
}

export function usePersistentSet() {
  const [completed, setCompleted] = useState(() => {
    try {
      return parseSet(localStorage.getItem(STORAGE_KEY));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      const value = JSON.stringify([...completed]);
      // Skip no-op writes so a change received from another tab isn't echoed back.
      if (localStorage.getItem(STORAGE_KEY) !== value) {
        localStorage.setItem(STORAGE_KEY, value);
      }
    } catch {
      // Storage may be full or unavailable; progress stays in memory for this session.
    }
  }, [completed]);
  // Adopt changes saved by other open tabs, so the last tab to save doesn't erase them.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        setCompleted(parseSet(event.newValue));
      }
    };
    addEventListener("storage", onStorage);
    return () => removeEventListener("storage", onStorage);
  }, []);
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
