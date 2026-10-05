import { describe, expect, it } from "vitest";
import {
  levelFor,
  scoreAnswer,
  totalScore,
  type Level,
} from "../server/_lib/scoring";
import questions from "../db/questions.json";
const levels: Level[] = [
  { key: "acquis", min: 14, label: "Acquis", description: "" },
  { key: "a_consolider", min: 10, label: "À consolider", description: "" },
  { key: "non_acquis", min: 0, label: "Non acquis", description: "" },
];
describe("Barème du classeur", () => {
  it.each([
    [20, "acquis"],
    [14, "acquis"],
    [13, "a_consolider"],
    [10, "a_consolider"],
    [9, "non_acquis"],
    [0, "non_acquis"],
  ])("classe %i dans %s", (score, key) =>
    expect(levelFor(score, levels).key).toBe(key),
  );
  it("attribue un point et aucun point négatif", () => {
    expect(scoreAnswer({ selected: "a", correct: "a", points: 1 })).toBe(1);
    expect(scoreAnswer({ selected: null, correct: "a", points: 1 })).toBe(0);
    expect(scoreAnswer({ selected: "b", correct: "a", points: 1 })).toBe(0);
  });
  it("adapte le maximum au nombre réel de questions", () =>
    expect(
      totalScore(questions.map((q) => ({ ...q, selected: q.correct }))),
    ).toBe(questions.length));
});
