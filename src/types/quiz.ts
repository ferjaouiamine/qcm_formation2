export type Option = { id: "a" | "b" | "c" | "d"; label: string };
export type Question = {
  id: number;
  position: number;
  module: string;
  text: string;
  options: Option[];
};
export type Quiz = {
  title: string;
  subtitle: string;
  instructions: string;
  duration_min: number;
  max_score: number;
  passing_score: number;
  questions: Question[];
};
export type Correction = Question & {
  selected: string | null;
  correct: string;
  explanation: string;
  is_correct: boolean;
};
export type Result = {
  score: number;
  max_score: number;
  passed: boolean;
  level: string;
  submitted_at: string;
  duration_sec: number;
  full_name: string;
  agency: string;
  levels: { key: string; label: string; description: string }[];
  correction: Correction[];
};
export type Session = {
  attemptId: string;
  expiresAt: string;
  serverNow: string;
  token: string;
  fullName: string;
  agency: string;
  answers: Record<number, string>;
  pending: Record<number, { selected: string; revision: number }>;
  currentIndex: number;
  away?: boolean;
};
export type RemoteSession = {
  status: string;
  expiresAt: string;
  serverNow: string;
  quiz: Quiz;
  answers: { question_id: number; selected: string | null; revision: number }[];
};
