import { useCountdown } from "../hooks";

// Kept separate so the per-second tick only re-renders this component, not the whole app.
export function Countdown({ targetTime }) {
  const countdown = useCountdown(targetTime);
  return (
    <div class="headline-stat">
      <strong>
        {countdown.remaining > 0
          ? `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}:${String(countdown.minutes).padStart(2, "0")}:${String(countdown.seconds).padStart(2, "0")}`
          : "Bank is closed"}
      </strong>
      <span>until Bank shuts down</span>
    </div>
  );
}
