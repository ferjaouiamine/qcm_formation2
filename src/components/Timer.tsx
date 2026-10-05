import { useEffect, useRef, useState } from "react";
export function Timer({
  expiresAt,
  offset = 0,
  onEnd,
}: {
  expiresAt: string;
  offset?: number;
  onEnd: () => void;
}) {
  const callback = useRef(onEnd);
  callback.current = onEnd;
  const remaining = () =>
    Math.max(
      0,
      Math.ceil((new Date(expiresAt).getTime() - Date.now() - offset) / 1000),
    );
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    let ended = false;
    const tick = () => {
      const n = Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now() - offset) / 1000),
      );
      setSeconds(n);
      if (n === 0 && !ended) {
        ended = true;
        callback.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, offset]);
  return (
    <span
      role="timer"
      aria-label="Temps restant"
      className={`text-2xl font-bold tabular-nums ${seconds <= 300 ? "text-amber-300" : ""}`}
    >
      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
    </span>
  );
}
