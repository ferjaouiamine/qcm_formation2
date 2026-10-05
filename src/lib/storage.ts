import type { Session } from "../types/quiz";
export const SESSION_KEY = "assurance-vie-session";
export const RESULT_KEY = "assurance-vie-result";
export function readSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s?.attemptId && s?.token
      ? { ...s, pending: s.pending || {}, currentIndex: s.currentIndex || 0 }
      : null;
  } catch {
    return null;
  }
}
export function persistSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
