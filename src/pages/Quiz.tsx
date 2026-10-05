import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSession, resetAttempt, saveAnswer, submit } from "../lib/api";
import {
  persistSession,
  readSession,
  RESULT_KEY,
  SESSION_KEY,
} from "../lib/storage";
import type { Quiz, Session } from "../types/quiz";
import { Timer } from "../components/Timer";
export function QuizPage() {
  const nav = useNavigate(),
    [session, setSession] = useState(readSession),
    sessionRef = useRef(session);
  const [quiz, setQuiz] = useState<Quiz | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [expired, setExpired] = useState(false),
    [restarted, setRestarted] = useState(false);
  const [offset, setOffset] = useState(0),
    [reload, setReload] = useState(0),
    [confirm, setConfirm] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    flight = useRef<Promise<void> | null>(null),
    finishing = useRef(false);
  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);
  useEffect(() => cancelAdvance, [cancelAdvance]);
  const update = useCallback((s: Session) => {
    sessionRef.current = s;
    setSession(s);
    persistSession(s);
  }, []);
  useEffect(() => {
    let active = true;
    const s0 = sessionRef.current;
    if (!s0) return;
    let s = s0;
    (s0.away ? resetAttempt(s0) : Promise.resolve(null))
      .then((r) => {
        if (!active || !r) return;
        s = { ...s0, away: false };
        if (r.reset) {
          s = { ...s, answers: {}, pending: {}, currentIndex: 0 };
          setRestarted(true);
        }
        update(s);
      })
      .then(() => getSession(s))
      .then(async (remote) => {
        if (!active) return;
        if (remote.status === "submitted") {
          const r = await submit(s);
          if (!active) return;
          const unsynced = Object.entries(s.pending).filter(
            ([id, item]) =>
              !remote.answers.some(
                (a) =>
                  a.question_id === Number(id) &&
                  a.selected === item.selected &&
                  a.revision >= item.revision,
              ),
          ).length;
          localStorage.setItem(RESULT_KEY, JSON.stringify({ ...r, unsynced }));
          localStorage.removeItem(SESSION_KEY);
          nav("/results", { replace: true });
          return;
        }
        const answers: Record<number, string> = {};
        for (const a of remote.answers)
          if (a.selected) answers[a.question_id] = a.selected;
        const pending = { ...s.pending };
        for (const [id, a] of Object.entries(pending)) {
          const saved = remote.answers.find(
            (item) => item.question_id === Number(id),
          );
          if (saved && saved.revision >= a.revision) delete pending[Number(id)];
          else answers[Number(id)] = a.selected;
        }
        update({
          ...s,
          answers,
          pending,
          expiresAt: remote.expiresAt,
          currentIndex: Math.min(
            s.currentIndex,
            remote.quiz.questions.length - 1,
          ),
        });
        setOffset(new Date(remote.serverNow).getTime() - Date.now());
        setQuiz(remote.quiz);
        setError("");
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [nav, reload, update]);
  const sync = useCallback(async () => {
    if (flight.current) return flight.current;
    const work = async () => {
      setSaving(true);
      try {
        while (
          sessionRef.current &&
          Object.keys(sessionRef.current.pending).length
        ) {
          const s = sessionRef.current,
            [key, item] = Object.entries(s.pending)[0];
          await saveAnswer(s, Number(key), item.selected, item.revision);
          const latest = sessionRef.current!;
          if (latest.pending[Number(key)]?.revision === item.revision) {
            const pending = { ...latest.pending };
            delete pending[Number(key)];
            update({ ...latest, pending });
          }
        }
      } finally {
        setSaving(false);
      }
    };
    flight.current = work();
    try {
      await flight.current;
    } finally {
      flight.current = null;
    }
  }, [update]);
  useEffect(() => {
    if (!quiz) return;
    const retry = () => {
      if (
        !finishing.current &&
        Date.now() + offset < new Date(sessionRef.current!.expiresAt).getTime()
      )
        void sync().catch(() => {});
    };
    retry();
    const id = setInterval(retry, 5000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", retry);
    };
  }, [quiz, sync, offset]);
  useEffect(() => {
    if (!quiz || expired) return;
    const leave = () => {
      const s = sessionRef.current;
      if (s && !s.away && !finishing.current) update({ ...s, away: true });
    };
    const back = () => {
      if (!sessionRef.current?.away) return;
      cancelAdvance();
      setConfirm(false);
      setQuiz(null);
      setReload((x) => x + 1);
    };
    const visibility = () => (document.hidden ? leave() : back());
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
    };
  }, [quiz, expired, update, cancelAdvance]);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  const finish = useCallback(
    async (auto = false) => {
      if (finishing.current || !sessionRef.current) return;
      cancelAdvance();
      finishing.current = true;
      setBusy(true);
      setError("");
      const isExpired =
        auto ||
        Date.now() + offset >= new Date(sessionRef.current.expiresAt).getTime();
      if (isExpired) setExpired(true);
      try {
        if (!isExpired) await sync();
        else if (flight.current) await flight.current.catch(() => {});
        const current = sessionRef.current!,
          r = await submit(current);
        localStorage.setItem(
          RESULT_KEY,
          JSON.stringify({
            ...r,
            unsynced: Object.keys(current.pending).length,
          }),
        );
        localStorage.removeItem(SESSION_KEY);
        nav("/results", { replace: true });
      } catch (e) {
        setError(
          isExpired
            ? "Le temps est écoulé. Reconnectez-vous puis réessayez de consulter votre résultat."
            : `La soumission n’a pas abouti. ${e instanceof Error ? e.message : ""}`,
        );
        setConfirm(false);
      } finally {
        finishing.current = false;
        setBusy(false);
      }
    },
    [nav, offset, sync, cancelAdvance],
  );
  const onEnd = useCallback(() => {
    void finish(true);
  }, [finish]);
  if (!session)
    return (
      <main className="mx-auto max-w-xl p-8">
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Aucune évaluation en cours</h1>
          <Link className="btn primary mt-5 inline-block" to="/">
            Retour à l’accueil
          </Link>
        </div>
      </main>
    );
  if (!quiz)
    return (
      <main className="mx-auto max-w-xl p-8">
        <div className="card p-8">
          <p role={error ? "alert" : "status"}>
            {error || "Reprise de votre évaluation…"}
          </p>
          {error && (
            <button
              className="btn primary mt-5"
              onClick={() => setReload((x) => x + 1)}
            >
              Réessayer
            </button>
          )}
        </div>
      </main>
    );
  const index = session.currentIndex,
    q = quiz.questions[index],
    answered = Object.keys(session.answers).length,
    pending = Object.keys(session.pending).length;
  function choose(selected: string) {
    if (busy || expired) return;
    cancelAdvance();
    const s = sessionRef.current!;
    update({
      ...s,
      answers: { ...s.answers, [q.id]: selected },
      pending: {
        ...s.pending,
        [q.id]: { selected, revision: Math.round(Date.now() + offset) },
      },
    });
    void sync().catch(() => {});
    if (index < quiz!.questions.length - 1) {
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        const latest = sessionRef.current;
        if (
          !latest ||
          latest.currentIndex !== index ||
          finishing.current ||
          Date.now() + offset >= new Date(latest.expiresAt).getTime()
        )
          return;
        go(index + 1);
      }, 250);
    }
  }
  function go(i: number) {
    cancelAdvance();
    update({ ...sessionRef.current!, currentIndex: i });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function confirmFinish() {
    cancelAdvance();
    setConfirm(true);
  }
  return (
    <main className="min-h-screen pb-8">
      <header className="sticky top-0 z-10 bg-[#102d4e] text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-200">
              Formation assurance vie
            </p>
            <strong className="mt-1 block">{session.fullName}</strong>
          </div>
          <div className="rounded-xl bg-white/10 px-5 py-2 text-center">
            <span className="block text-xs text-blue-200">Temps restant</span>
            <Timer
              expiresAt={session.expiresAt}
              offset={offset}
              onEnd={onEnd}
            />
          </div>
        </div>
        <div className="h-1 bg-blue-950">
          <div
            className="h-full bg-amber-400"
            style={{ width: `${(100 * answered) / quiz.questions.length}%` }}
          />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5">
        {error && (
          <div role="alert" className="alert mb-5">
            {error}
            {expired && (
              <button
                className="btn mt-2 border"
                disabled={busy}
                onClick={() => void finish(true)}
              >
                Réessayer
              </button>
            )}
          </div>
        )}
        {restarted && (
          <div role="alert" className="alert mb-5">
            Vous avez quitté la page de l’évaluation : vos réponses ont été
            effacées et le QCM a recommencé à la question 1.
            <button
              className="ml-2 font-semibold underline"
              onClick={() => setRestarted(false)}
            >
              J’ai compris
            </button>
          </div>
        )}
        {expired && (
          <p role="status" className="alert mb-5">
            Le temps est écoulé. Vos réponses sont verrouillées.
          </p>
        )}
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_290px]">
          <section className="card p-5 sm:p-8">
            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <span className="font-bold text-cyan-800">
                QUESTION {index + 1} / {quiz.questions.length}
              </span>
              <span className="muted">1 point</span>
            </div>
            <p className="mt-5 text-sm font-semibold text-cyan-700">
              Module {q.module}
            </p>
            <fieldset disabled={busy || expired} className="mt-3">
              <legend className="text-xl font-bold leading-snug sm:text-2xl">
                {q.text}
              </legend>
              <p className="mt-3 text-sm muted">
                {index < quiz.questions.length - 1
                  ? "Sélectionnez une seule réponse. Vous passerez automatiquement à la question suivante."
                  : "Sélectionnez une seule réponse, puis terminez l’évaluation lorsque vous êtes prêt."}
              </p>
              <div className="mt-6 grid gap-3">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={`answer-option ${session.answers[q.id] === o.id ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={o.id}
                      checked={session.answers[q.id] === o.id}
                      onChange={() => choose(o.id)}
                    />
                    <span className="option-letter">{o.id.toUpperCase()}</span>
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-8 flex justify-between gap-3 border-t pt-5">
              <button
                className="btn border"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                ← Précédente
              </button>
              {index < quiz.questions.length - 1 ? (
                <button className="btn primary" onClick={() => go(index + 1)}>
                  Suivante →
                </button>
              ) : (
                <button
                  className="btn primary"
                  disabled={busy || expired}
                  onClick={confirmFinish}
                >
                  Terminer →
                </button>
              )}
            </div>
          </section>
          <aside className="card p-5 lg:sticky lg:top-28">
            <h2 className="font-bold">Votre progression</h2>
            <p className="mt-2 text-sm muted">
              {answered} / {quiz.questions.length} questions renseignées
            </p>
            <div className="my-5 grid grid-cols-5 gap-2">
              {quiz.questions.map((item, i) => (
                <button
                  className={`question-number ${session.answers[item.id] ? "answered" : ""} ${i === index ? "current" : ""}`}
                  key={item.id}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${i + 1}, ${session.answers[item.id] ? "répondue" : "sans réponse"}`}
                  onClick={() => go(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p
              className={`text-sm ${pending ? "text-amber-800" : "text-emerald-800"}`}
              role="status"
            >
              {saving
                ? "Sauvegarde en cours…"
                : pending
                  ? `${pending} réponse(s) en attente de synchronisation`
                  : "✓ Toutes les réponses sont sauvegardées"}
            </p>
            {pending > 0 && (
              <button
                className="mt-2 text-sm font-semibold underline"
                disabled={saving || expired}
                onClick={() => void sync().catch((e) => setError(e.message))}
              >
                Réessayer la sauvegarde
              </button>
            )}
            <button
              className="btn primary mt-5 w-full"
              disabled={busy || expired}
              onClick={confirmFinish}
            >
              {busy ? "Soumission…" : "Terminer l’évaluation"}
            </button>
            <p className="mt-3 text-xs muted">
              Vous pourrez vérifier le nombre de réponses avant de confirmer.
            </p>
          </aside>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="confirmation card"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setConfirm(false);
        }}
        aria-labelledby="confirmation-title"
      >
        <h2 id="confirmation-title" className="text-2xl font-bold">
          Terminer l’évaluation ?
        </h2>
        <p className="mt-4 leading-relaxed">
          Vous avez répondu à{" "}
          <strong>
            {answered} questions sur {quiz.questions.length}
          </strong>
          . Il reste{" "}
          <strong>
            {quiz.questions.length - answered} question(s) sans réponse
          </strong>
          . La soumission est définitive.
        </p>
        {pending > 0 && (
          <p className="mt-3 text-amber-800">
            Les réponses en attente seront sauvegardées avant la soumission.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            autoFocus
            disabled={busy}
            className="btn border flex-1"
            onClick={() => setConfirm(false)}
          >
            Continuer le QCM
          </button>
          <button
            disabled={busy}
            className="btn primary flex-1"
            onClick={() => void finish()}
          >
            {busy ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </dialog>
    </main>
  );
}
