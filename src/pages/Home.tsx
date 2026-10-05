import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAttempt, getQuiz } from "../lib/api";
import { persistSession, readSession, RESULT_KEY } from "../lib/storage";
export function Home() {
  const nav = useNavigate(),
    query = useQuery({ queryKey: ["quiz"], queryFn: getQuiz });
  const [name, setName] = useState(""),
    [agency, setAgency] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saved = readSession(),
    data = query.data;
  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("storage-check", "1");
      localStorage.removeItem("storage-check");
      const a = await createAttempt(name.trim(), agency.trim());
      persistSession({
        ...a,
        fullName: name.trim(),
        agency: agency.trim(),
        answers: {},
        pending: {},
        currentIndex: 0,
      });
      localStorage.removeItem(RESULT_KEY);
      nav("/quiz");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de commencer.");
    } finally {
      setBusy(false);
    }
  }
  const modules = [...new Set(data?.questions.map((q) => q.module))];
  return (
    <main className="min-h-screen">
      <header className="hero">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <nav className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 font-bold">
              <span className="brand-mark">AV</span>
              <span>Formation assurance vie</span>
            </Link>
          </nav>
          <div className="max-w-3xl py-12 md:py-16">
            <p className="eyebrow text-amber-300">
              Évaluation de fin de formation
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-6xl">
              Faites le point sur
              <br />
              vos connaissances.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-blue-100">
              Cadre réglementaire, caractéristiques des contrats et fiscalité :
              évaluez votre maîtrise de l’assurance vie.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pb-5 sm:grid-cols-4">
            {[
              [data?.questions.length, "questions"],
              [data?.max_score, "points"],
              [data?.duration_min, "minutes"],
              [
                data
                  ? `${Math.round((100 * data.passing_score) / data.max_score)} %`
                  : undefined,
                "seuil acquis",
              ],
            ].map(([n, label]) => (
              <div
                className="rounded-xl border border-white/15 bg-white/5 p-4"
                key={label}
              >
                <strong className="text-2xl">{n ?? "—"}</strong>
                <p className="mt-1 text-sm text-blue-100">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="eyebrow text-cyan-700">Avant de commencer</p>
          <h2 className="mt-2 text-2xl font-bold">
            Un parcours, quatre modules.
          </h2>
          <div className="my-6 grid gap-3">
            {modules.map((m, i) => (
              <div
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
                key={m}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-50 font-bold text-cyan-800">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{m.replace(/^\d+\s*[–—-]\s*/, "")}</strong>
                  <p className="text-sm muted">
                    {data?.questions.filter((q) => q.module === m).length}{" "}
                    questions
                  </p>
                </div>
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed muted">
            <li>Une seule réponse par question. Aucun point négatif.</li>
            <li>Vous pouvez revenir sur vos réponses avant de terminer.</li>
            <li>La minuterie continue si vous fermez ou rechargez la page.</li>
            <li>
              Les réponses sont sauvegardées et le corrigé s’affiche à la fin.
            </li>
          </ul>
          <p className="mt-5 text-sm muted">
            Barème du document : acquis ≥ 70 % · à consolider ≥ 50 % · non
            acquis &lt; 50 %.
          </p>
        </section>
        <form className="card self-start p-6 sm:p-8" onSubmit={start}>
          <p className="eyebrow text-cyan-700">Votre évaluation</p>
          <h2 className="mt-2 text-2xl font-bold">
            Identifiez-vous pour commencer
          </h2>
          <p className="mt-2 text-sm muted">
            Ces informations apparaîtront sur votre résultat et dans le suivi du
            formateur.
          </p>
          {query.isLoading && (
            <p className="mt-5" role="status">
              Chargement du questionnaire…
            </p>
          )}
          {query.isError && (
            <div className="alert mt-5" role="alert">
              Impossible de charger le questionnaire.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => query.refetch()}
              >
                Réessayer
              </button>
            </div>
          )}
          {error && (
            <p className="alert mt-5" role="alert">
              {error}
            </p>
          )}
          {saved ? (
            <div className="mt-6 rounded-xl bg-blue-50 p-5">
              <strong>Une tentative est déjà enregistrée</strong>
              <p className="mt-2 muted">
                {saved.fullName} · {saved.agency}
              </p>
              <button
                type="button"
                className="btn primary mt-4 w-full"
                onClick={() => nav("/quiz")}
              >
                Reprendre / consulter le résultat →
              </button>
            </div>
          ) : (
            <>
              <label className="mt-6 block font-semibold">
                Nom et prénom
                <input
                  autoComplete="name"
                  placeholder="Votre nom complet"
                  className="field mt-2"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="mt-4 block font-semibold">
                Agence / entité
                <input
                  autoComplete="organization"
                  placeholder="Votre agence ou établissement"
                  className="field mt-2"
                  required
                  minLength={2}
                  maxLength={120}
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                />
              </label>
              <button
                disabled={
                  busy ||
                  !data ||
                  name.trim().length < 2 ||
                  agency.trim().length < 2
                }
                className="btn primary mt-6 w-full"
              >
                {busy ? "Préparation…" : "Commencer l’évaluation →"}
              </button>
              <p className="mt-3 text-center text-xs muted">
                Le chronomètre démarre lorsque vous commencez.
              </p>
            </>
          )}
          {localStorage.getItem(RESULT_KEY) && (
            <Link
              className="mt-5 block text-center font-semibold text-blue-800 underline"
              to="/results"
            >
              Consulter mon dernier résultat
            </Link>
          )}
        </form>
      </div>
      <footer className="mx-auto max-w-6xl border-t px-5 py-6 text-sm muted">
        Formation assurance vie · Questionnaire et corrigé issus du document
        fourni.
      </footer>
    </main>
  );
}
