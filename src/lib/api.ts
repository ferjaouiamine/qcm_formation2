import type { Quiz, Result, Session, RemoteSession } from "../types/quiz";
export async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message ?? "Erreur réseau");
  return data as T;
}
const tokenHeaders = (s: Session) => ({ "X-Attempt-Token": s.token });
export const getQuiz = () => call<Quiz>("/api/questions");
export const createAttempt = (fullName: string, agency: string) =>
  call<Pick<Session, "attemptId" | "expiresAt" | "serverNow" | "token">>(
    "/api/attempts",
    { method: "POST", body: JSON.stringify({ fullName, agency }) },
  );
export const getSession = (s: Session) =>
  call<RemoteSession>(`/api/attempts/${s.attemptId}/session`, {
    headers: tokenHeaders(s),
  });
export const resetAttempt = (s: Session) =>
  call<{ reset: boolean }>(`/api/attempts/${s.attemptId}/reset`, {
    method: "POST",
    headers: tokenHeaders(s),
    body: "{}",
  });
export const saveAnswer = (
  s: Session,
  questionId: number,
  selected: string,
  revision: number,
) =>
  call<{ saved: boolean }>(`/api/attempts/${s.attemptId}/answers`, {
    method: "PATCH",
    headers: tokenHeaders(s),
    body: JSON.stringify({ questionId, selected, revision }),
  });
export const submit = (s: Session) =>
  call<Result>(`/api/attempts/${s.attemptId}/submit`, {
    method: "POST",
    headers: tokenHeaders(s),
    body: "{}",
  });
export const getResult = (s: Session) =>
  call<Result>(`/api/attempts/${s.attemptId}/result`, {
    headers: tokenHeaders(s),
  });
export const adminGet = <T>(url: string) => call<T>(url);
export const adminLogin = (email: string, password: string) =>
  call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const adminLogout = () =>
  call("/api/auth/logout", { method: "POST", body: "{}" });
