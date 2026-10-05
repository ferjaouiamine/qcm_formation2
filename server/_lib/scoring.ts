export type Level = {
  key: string;
  min: number;
  label: string;
  description: string;
};
export type ScoredAnswer = {
  selected: string | null;
  correct: string;
  points: number;
};
export const scoreAnswer = (a: ScoredAnswer) =>
  a.selected === a.correct ? Math.max(0, a.points) : 0;
export const totalScore = (answers: ScoredAnswer[]) =>
  answers.reduce((sum, a) => sum + scoreAnswer(a), 0);
export function levelFor(score: number, levels: Level[]): Level {
  const ordered = [...levels].sort((a, b) => b.min - a.min);
  const fallback = ordered.at(-1);
  if (!fallback) throw new Error("Barème vide");
  return ordered.find((l) => score >= l.min) ?? fallback;
}
