import { useState } from "react";
import { Link } from "react-router-dom";
import type { Result } from "../types/quiz";
import { RESULT_KEY } from "../lib/storage";
function stored(): (Result & { unsynced?: number }) | null {
  try {
    return JSON.parse(localStorage.getItem(RESULT_KEY) || "null");
  } catch {
    return null;
  }
}
export function Results() {
  const [r] = useState(stored),
    [errors, setErrors] = useState(false);
  if (!r)
    return (
      <main className="mx-auto max-w-xl p-8">
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Résultat indisponible</h1>
          <Link className="btn primary mt-5 inline-block" to="/">
            Retour à l’accueil
          </Link>
        </div>
      </main>
    );
  const level = r.levels.find((l) => l.key === r.level),
    correct = r.correction.filter((q) => q.is_correct).length,
    unanswered = r.correction.filter((q) => !q.selected).length;
  const modules = [...new Set(r.correction.map((q) => q.module))];
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <Link className="no-print text-sm font-semibold text-blue-800" to="/">
        ← Retour à l’accueil
      </Link>
      <header className="card mt-5 overflow-hidden">
        <div className="hero px-6 py-8 text-center">
          <p className="eyebrow text-blue-200">Évaluation terminée</p>
          <h1 className="mt-3 text-2xl font-bold">
            Votre résultat, {r.full_name}
          </h1>
          <p className="mt-1 text-blue-100">{r.agency}</p>
          <p className="my-5 text-6xl font-black">
            {r.score}
            <span className="text-3xl text-blue-200"> / {r.max_score}</span>
          </p>
          <span className="inline-block rounded-full bg-white px-5 py-2 font-bold text-[#102d4e]">
            {level?.label} · {Math.round((100 * r.score) / r.max_score)} %
          </span>
          <p className="mt-3 text-sm text-blue-100">
            {level?.description} · Note sur 20 :{" "}
            {((r.score / r.max_score) * 20).toLocaleString("fr-FR", {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-5 text-center">
          {[
            [correct, "Bonnes réponses"],
            [r.correction.length - correct - unanswered, "Erreurs"],
            [unanswered, "Sans réponse"],
          ].map(([n, label]) => (
            <div key={label}>
              <strong className="text-2xl">{n}</strong>
              <p className="text-xs muted sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </header>
      {Boolean(r.unsynced) && (
        <p className="alert mt-5" role="alert">
          À l’expiration du délai, {r.unsynced} réponse(s) locale(s) n’avaient
          pas pu être synchronisées. La note tient compte des réponses reçues
          par le serveur.
        </p>
      )}
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {modules.map((module) => {
          const items = r.correction.filter((q) => q.module === module),
            n = items.filter((q) => q.is_correct).length;
          return (
            <div className="card p-5" key={module}>
              <h2 className="font-semibold">{module}</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-cyan-700"
                    style={{ width: `${(100 * n) / items.length}%` }}
                  />
                </div>
                <strong>
                  {n} / {items.length}
                </strong>
              </div>
            </div>
          );
        })}
      </section>
      <div className="no-print my-7 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Votre corrigé détaillé</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn border bg-white"
            aria-pressed={errors}
            onClick={() => setErrors((x) => !x)}
          >
            {errors ? "Toutes les réponses" : "Erreurs uniquement"}
          </button>
          <button
            className="btn primary"
            onClick={() =>
              void import("../lib/pdf").then((m) => m.exportResult(r))
            }
          >
            Télécharger le PDF
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {errors && correct === r.correction.length && (
          <p className="card p-6 text-emerald-800">
            Aucune erreur. Toutes les réponses sont correctes.
          </p>
        )}
        {r.correction
          .filter((q) => !errors || !q.is_correct)
          .map((q) => (
            <article
              className={`card border-l-4 p-6 ${q.is_correct ? "border-l-emerald-500" : "border-l-amber-500"}`}
              key={q.id}
            >
              <p
                className={`text-sm font-bold ${q.is_correct ? "text-emerald-800" : "text-amber-800"}`}
              >
                QUESTION {q.position} ·{" "}
                {q.is_correct
                  ? "Bonne réponse"
                  : q.selected
                    ? "Réponse incorrecte"
                    : "Sans réponse"}
              </p>
              <h3 className="mt-3 text-lg font-bold">{q.text}</h3>
              <p className="mt-4">
                Votre réponse :{" "}
                <strong>
                  {q.selected?.toUpperCase() ?? "—"} ·{" "}
                  {q.options.find((o) => o.id === q.selected)?.label ??
                    "Aucune réponse"}
                </strong>
              </p>
              <p className="mt-2 text-emerald-800">
                Bonne réponse :{" "}
                <strong>
                  {q.correct.toUpperCase()} ·{" "}
                  {q.options.find((o) => o.id === q.correct)?.label}
                </strong>
              </p>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="mb-1 text-sm font-bold text-slate-500">
                  JUSTIFICATION DU DOCUMENT
                </p>
                <p className="leading-relaxed">{q.explanation}</p>
              </div>
            </article>
          ))}
      </div>
    </main>
  );
}
