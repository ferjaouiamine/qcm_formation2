import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { call } from "../lib/api";
import type { Result } from "../types/quiz";

export function Results() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    let access: { attemptId?: string; token?: string };
    try { access = JSON.parse(sessionStorage.getItem("result-access") || "null"); }
    catch { access = {}; }
    if (!access?.attemptId || !access?.token) {
      navigate("/merci", { replace: true });
      return;
    }
    call<Result>(`/api/attempts/${encodeURIComponent(access.attemptId)}/result`, {
      headers: { "X-Attempt-Token": access.token },
    }).then((data) => { if (active) setResult(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [navigate, retry]);
  if (error) return <main className="mx-auto max-w-3xl p-6"><p role="alert">Résultats indisponibles ou accès non autorisé.</p><button className="btn primary mt-4" onClick={() => setRetry(x => x + 1)}>Réessayer</button></main>;
  if (!result) return <p role="status" className="p-8 text-center">Chargement des résultats…</p>;
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
    <section className="card p-6">
      <h1 className="text-3xl font-extrabold">Vos résultats</h1>
      <p className="mt-3">{result.full_name} · {result.agency}</p>
      <p className="mt-4 text-3xl font-bold">{result.score} / {result.max_score}</p>
      <p>{result.levels.find(level => level.key === result.level)?.label}</p>
      <p className="mt-2">{result.correction.filter(q => q.is_correct).length} bonne(s) réponse(s) · {result.correction.filter(q => !q.is_correct).length} erreur(s) ou réponse(s) manquante(s)</p>
    </section>
    {result.correction.map(q => <article key={q.id} className="card p-6">
      <h2 className="text-xl font-bold">{q.position}. {q.text}</h2>
      <p className={`mt-3 font-semibold ${q.is_correct ? "text-teal-700" : "text-red-700"}`}>{q.is_correct ? "Bonne réponse" : "Réponse incorrecte ou manquante"}</p>
      <ul className="my-4 space-y-2">{q.options.map(option => <li key={option.id} className={option.id === q.correct ? "font-bold text-teal-700" : ""}>
        {option.id.toUpperCase()}. {option.label}{option.id === q.selected ? " — Votre réponse" : ""}{option.id === q.correct ? " — Bonne réponse" : ""}
      </li>)}</ul>
      <p><strong>Justification : </strong>{q.explanation}</p>
    </article>)}
  </main>;
}
