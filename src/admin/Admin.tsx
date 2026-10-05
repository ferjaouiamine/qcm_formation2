import type { Correction } from "../types/quiz";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminGet, adminLogin, adminLogout } from "../lib/api";

type View = "overview" | "candidates" | "questions" | "agencies";
type Stats = {
  candidates: number;
  completed: number;
  in_progress: number;
  average: number | null;
  median: number | null;
  pass_rate: number | null;
  average_duration: number | null;
  levels: { level: string; value: number }[];
};
type Timeline = {
  date: string;
  attempts: number;
  average_score: number | null;
};
type QuestionStat = {
  id: number;
  position: number;
  text: string;
  options: { id: string; label: string }[];
  correct: string;
  responses: number;
  success_rate: number | null;
  unanswered_rate: number | null;
  distribution: Record<string, number>;
};
type Agency = {
  agency: string;
  candidates: number;
  completed: number;
  average_score: number | null;
  pass_rate: number | null;
};
type Attempt = {
  id: string;
  full_name: string;
  agency: string;
  started_at: string;
  submitted_at: string | null;
  duration_sec: number | null;
  score: number | null;
  max_score: number;
  passed: boolean | null;
  level: string | null;
  status: string;
};
type AttemptList = {
  items: Attempt[];
  total: number;
  page: number;
  pageSize: number;
  agencies: string[];
};
type Detail = Attempt & {
  levels: { key: string; label: string; description: string }[];
  answers: Correction[];
};
const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#d97706", "#dc2626"];
const levelLabel = (value: string | null) =>
  ({
    acquis: "Acquis",
    a_consolider: "À consolider",
    non_acquis: "Non acquis",
  })[value ?? ""] ?? "Non déterminé";
const dateFr = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const numberFr = (value: number | null, digits = 1) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(
        value,
      );
const duration = (seconds: number | null) =>
  seconds == null ? "—" : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminLogin(email, password);
      onSuccess();
    } catch {
      setError("Adresse e-mail ou mot de passe incorrect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef3f8] p-5">
      <form className="card w-full max-w-md p-8" onSubmit={login}>
        <div className="mb-7 flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-600 text-xl font-black text-white">
            AV
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-cyan-700">
              Espace sécurisé
            </p>
            <h1 className="text-2xl font-extrabold text-[#102d4e]">
              Administration
            </h1>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}
        <label className="block font-semibold">
          Adresse e-mail
          <input
            type="email"
            autoComplete="username"
            required
            className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-4 block font-semibold">
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button disabled={busy} className="btn primary mt-6 w-full">
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

function Empty({ children }: { children: string }) {
  return <div className="card p-10 text-center text-slate-500">{children}</div>;
}
function ErrorState() {
  return (
    <div
      className="card border-red-200 bg-red-50 p-6 text-red-700"
      role="alert"
    >
      Impossible de charger ces données. Utilisez « Actualiser » ou réessayez
      dans quelques instants.
    </div>
  );
}
function Kpi({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: string;
}) {
  return (
    <article className="card border-l-4 border-l-cyan-500 p-5">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-black text-[#102d4e]">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{help}</p>
    </article>
  );
}

function Overview() {
  const stats = useQuery({
    queryKey: ["overview"],
    queryFn: () => adminGet<Stats>("/api/admin/stats/overview"),
    refetchInterval: 60000,
  });
  const timeline = useQuery({
    queryKey: ["timeline"],
    queryFn: () => adminGet<Timeline[]>("/api/admin/stats/timeline?days=30"),
    refetchInterval: 60000,
  });
  const questions = useQuery({
    queryKey: ["question-stats"],
    queryFn: () => adminGet<QuestionStat[]>("/api/admin/stats/questions"),
    refetchInterval: 60000,
  });
  const s = stats.data;
  const levels = (s?.levels ?? []).map((x) => ({
    name: levelLabel(x.level),
    value: x.value,
  }));
  if (stats.isLoading) return <p>Chargement des indicateurs…</p>;
  if (stats.error) return <ErrorState />;
  if (!s?.completed)
    return <Empty>Aucune tentative terminée pour le moment.</Empty>;
  const worst = [...(questions.data ?? [])]
    .filter((q) => q.responses > 0)
    .sort((a, b) => (a.success_rate ?? 101) - (b.success_rate ?? 101))
    .slice(0, 5);
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-end gap-3">
        <button
          className="btn primary"
          onClick={() =>
            void import("../lib/pdf").then((m) =>
              m.exportTable(
                "Synthèse de formation",
                ["Indicateur", "Valeur"],
                [
                  ["Candidats", s.candidates],
                  ["Terminées", s.completed],
                  ["En cours", s.in_progress],
                  ["Moyenne sur 20", numberFr(s.average)],
                  ["Médiane sur 20", numberFr(s.median)],
                  ["Réussite (%)", numberFr(s.pass_rate)],
                  ["Durée moyenne", duration(s.average_duration)],
                ],
              ),
            )
          }
        >
          Exporter en PDF
        </button>
        <button
          className="btn border bg-white"
          onClick={() => {
            stats.refetch();
            timeline.refetch();
            questions.refetch();
          }}
        >
          Actualiser les données
        </button>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Candidats"
          value={String(s.candidates)}
          help={`${s.in_progress} tentative${s.in_progress > 1 ? "s" : ""} en cours`}
        />
        <Kpi
          label="Note moyenne"
          value={`${numberFr(s.average)} / 20`}
          help={`Médiane : ${numberFr(s.median)} / 20`}
        />
        <Kpi
          label="Taux de réussite"
          value={`${numberFr(s.pass_rate)} %`}
          help="Seuil acquis : 70 %"
        />
        <Kpi
          label="Durée moyenne"
          value={duration(s.average_duration)}
          help={`${s.completed} tentative${s.completed > 1 ? "s" : ""} terminée${s.completed > 1 ? "s" : ""}`}
        />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <article className="card p-6">
          <h2 className="text-xl font-extrabold text-[#102d4e]">
            Évolution des résultats
          </h2>
          <p className="mt-1 text-sm muted">
            Note moyenne sur 20 des 30 derniers jours
          </p>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline.data ?? []}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                />
                <YAxis domain={[0, 20]} />
                <Tooltip
                  labelFormatter={(v) =>
                    new Date(String(v)).toLocaleDateString("fr-FR")
                  }
                />
                <Line
                  type="monotone"
                  dataKey="average_score"
                  name="Note moyenne"
                  stroke="#0891b2"
                  strokeWidth={3}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card p-6">
          <h2 className="text-xl font-extrabold text-[#102d4e]">
            Niveaux atteints
          </h2>
          <p className="mt-1 text-sm muted">
            Répartition des résultats terminés
          </p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={levels}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {levels.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {levels.map((x, i) => (
              <li key={x.name}>
                <span
                  style={{ background: COLORS[i % COLORS.length] }}
                  className="mr-2 inline-block h-3 w-3 rounded-full"
                />
                {x.name} : <strong>{x.value}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <section className="card mt-6 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-extrabold text-[#102d4e]">
            Questions à retravailler en priorité
          </h2>
          <p className="mt-1 text-sm muted">
            Les cinq taux de réussite les plus faibles
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-sm text-slate-500">
                <th className="p-4">Question</th>
                <th className="p-4">Réponses</th>
                <th className="p-4">Réussite</th>
                <th className="p-4">Sans réponse</th>
              </tr>
            </thead>
            <tbody>
              {worst.map((q) => (
                <tr className="border-t" key={q.id}>
                  <td className="p-4">
                    <strong className="mr-2 text-cyan-700">
                      Q{q.position}
                    </strong>
                    {q.text}
                  </td>
                  <td className="p-4">{q.responses}</td>
                  <td className="p-4 font-bold">
                    {numberFr(q.success_rate)} %
                  </td>
                  <td className="p-4">{numberFr(q.unanswered_rate)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Candidates() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [agency, setAgency] = useState(""),
    [level, setLevel] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const params = new URLSearchParams({
    page: String(page),
    search,
    agency,
    level,
  });
  const query = useQuery({
    queryKey: ["attempts", page, search, agency, level],
    queryFn: () => adminGet<AttemptList>(`/api/admin/attempts?${params}`),
  });
  const detail = useQuery({
    queryKey: ["attempt", selected],
    queryFn: () => adminGet<Detail>(`/api/admin/attempts/${selected}`),
    enabled: Boolean(selected),
  });
  if (selected)
    return (
      <CandidateDetail
        data={detail.data}
        loading={detail.isLoading}
        error={detail.isError}
        onBack={() => setSelected(null)}
      />
    );
  return (
    <>
      <div className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_200px_auto]">
        <input
          aria-label="Rechercher un candidat"
          placeholder="Rechercher par nom…"
          className="min-h-12 rounded-lg border p-3"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filtrer par agence"
          className="min-h-12 rounded-lg border p-3"
          value={agency}
          onChange={(e) => {
            setAgency(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Toutes les agences</option>
          {query.data?.agencies.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Filtrer par niveau"
          className="min-h-12 rounded-lg border p-3"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les niveaux</option>
          {["acquis", "a_consolider", "non_acquis"].map((x) => (
            <option value={x} key={x}>
              {levelLabel(x)}
            </option>
          ))}
        </select>
        <a
          className="btn primary grid place-items-center"
          href="/api/admin/export?format=csv"
        >
          Exporter en CSV
        </a>
      </div>
      {query.isLoading ? (
        <p>Chargement des candidats…</p>
      ) : query.error ? (
        <ErrorState />
      ) : !query.data?.items.length ? (
        <Empty>Aucun candidat ne correspond aux critères sélectionnés.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-sm text-slate-500">
                  <th className="p-4">Candidat</th>
                  <th className="p-4">Agence</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Durée</th>
                  <th className="p-4">Note</th>
                  <th className="p-4">Niveau</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((a) => (
                  <tr className="border-t" key={a.id}>
                    <td className="p-4 font-bold">{a.full_name}</td>
                    <td className="p-4">{a.agency}</td>
                    <td className="p-4 whitespace-nowrap">
                      {dateFr(a.submitted_at ?? a.started_at)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {duration(a.duration_sec)}
                    </td>
                    <td className="p-4 font-bold">
                      {a.score == null
                        ? "—"
                        : `${numberFr(a.score)} / ${a.max_score}`}
                    </td>
                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
                        {levelLabel(a.level)}
                      </span>
                    </td>
                    <td className="p-4">
                      {a.status === "submitted"
                        ? a.passed
                          ? "Réussi"
                          : "Non validé"
                        : "En cours"}
                    </td>
                    <td className="p-4">
                      <button
                        className="btn border bg-white"
                        onClick={() => setSelected(a.id)}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t p-4">
            <span className="text-sm muted">
              {query.data.total} tentative{query.data.total > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <button
                className="btn border"
                disabled={page === 1}
                onClick={() => setPage((x) => x - 1)}
              >
                Précédent
              </button>
              <button
                className="btn border"
                disabled={page * 25 >= query.data.total}
                onClick={() => setPage((x) => x + 1)}
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CandidateDetail({
  data,
  loading,
  error,
  onBack,
}: {
  data?: Detail;
  loading: boolean;
  error: boolean;
  onBack: () => void;
}) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  if (loading) return <p>Chargement du détail…</p>;
  if (error || !data) return <ErrorState />;
  const level = data.levels.find((x) => x.key === data.level);
  return (
    <>
      <div className="no-print mb-5 flex justify-between">
        <button className="btn border bg-white" onClick={onBack}>
          Retour aux candidats
        </button>
        <button
          className="btn primary"
          onClick={() =>
            void import("../lib/pdf").then((m) => m.exportResult(data))
          }
        >
          Exporter en PDF
        </button>
      </div>
      <section className="card p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-cyan-700">
          Détail de la tentative
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="text-3xl font-extrabold text-[#102d4e]">
              {data.full_name}
            </h2>
            <p className="mt-1 muted">
              {data.agency} · {dateFr(data.submitted_at ?? data.started_at)}
            </p>
          </div>
          <div className="text-right">
            <strong className="text-4xl text-[#102d4e]">
              {numberFr(data.score)} / {data.max_score}
            </strong>
            <p className="mt-1 font-semibold">
              {level?.label} — {level?.description}
            </p>
          </div>
        </div>
      </section>
      <div className="no-print my-5">
        <button
          className="btn border bg-white"
          onClick={() => setOnlyErrors((x) => !x)}
        >
          {onlyErrors
            ? "Afficher toutes les réponses"
            : "Afficher uniquement les erreurs"}
        </button>
      </div>
      <div className="space-y-4">
        {data.answers
          .filter((x) => !onlyErrors || !x.is_correct)
          .map((q) => (
            <article className="card p-5" key={q.id}>
              <p className="text-sm font-bold uppercase text-cyan-700">
                Question {q.position} —{" "}
                {q.is_correct
                  ? "Correct"
                  : q.selected
                    ? "Incorrect"
                    : "Sans réponse"}
              </p>
              <h3 className="mt-2 font-bold">{q.text}</h3>
              <p className="mt-3">
                Réponse du candidat :{" "}
                <strong>
                  {q.options.find((x) => x.id === q.selected)?.label ??
                    "Aucune réponse"}
                </strong>
              </p>
              {!q.is_correct && (
                <p>
                  Bonne réponse :{" "}
                  <strong>
                    {q.options.find((x) => x.id === q.correct)?.label}
                  </strong>
                </p>
              )}
              <p className="mt-3 rounded-lg bg-slate-50 p-4">{q.explanation}</p>
            </article>
          ))}
      </div>
    </>
  );
}

function Questions() {
  const query = useQuery({
    queryKey: ["question-stats"],
    queryFn: () => adminGet<QuestionStat[]>("/api/admin/stats/questions"),
  });
  const [ascending, setAscending] = useState(true);
  if (query.isLoading) return <p>Chargement de l’analyse…</p>;
  if (query.error) return <ErrorState />;
  const items = [...(query.data ?? [])].sort((a, b) =>
    ascending
      ? (a.success_rate ?? 101) - (b.success_rate ?? 101)
      : (b.success_rate ?? -1) - (a.success_rate ?? -1),
  );
  return (
    <>
      <div className="mb-5 flex justify-end gap-3">
        <button
          className="btn border bg-white"
          onClick={() => setAscending((x) => !x)}
        >
          Trier : réussite {ascending ? "croissante" : "décroissante"}
        </button>
        <button className="btn border bg-white" onClick={() => query.refetch()}>
          Actualiser
        </button>
      </div>
      <div className="space-y-4">
        {items.map((q) => (
          <article className="card p-5" key={q.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="max-w-3xl font-bold">
                <span className="mr-2 text-cyan-700">Q{q.position}</span>
                {q.text}
              </h2>
              <strong>{numberFr(q.success_rate)} % de réussite</strong>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-cyan-600"
                style={{ width: `${q.success_rate ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-sm muted">
              {q.responses} réponses · {numberFr(q.unanswered_rate)} % sans
              réponse · Bonne option : {q.correct.toUpperCase()}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {q.options.map((o) => (
                <div
                  className={`rounded-lg border p-3 ${o.id === q.correct ? "border-emerald-500 bg-emerald-50" : "bg-slate-50"}`}
                  key={o.id}
                >
                  <strong>{o.id.toUpperCase()}</strong>
                  <span className="float-right font-bold">
                    {q.distribution[o.id] ?? 0}
                  </span>
                  <p className="mt-1 truncate text-xs muted" title={o.label}>
                    {o.label}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Ranking() {
  const query = useQuery({
    queryKey: ["candidate-ranking"],
    queryFn: () =>
      adminGet<(Attempt & { rank: number })[]>("/api/admin/stats/ranking"),
  });
  if (query.isLoading) return <p>Chargement du classement…</p>;
  if (query.error) return <ErrorState />;
  if (!query.data?.length)
    return (
      <Empty>Aucune candidature terminée ne peut encore être classée.</Empty>
    );
  return (
    <div className="card overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-extrabold text-[#102d4e]">
            Classement des candidats
          </h2>
          <button
            className="btn primary"
            onClick={() =>
              void import("../lib/pdf").then((m) =>
                m.exportTable(
                  "Classement des candidats",
                  ["Rang", "Candidat", "Agence", "Note", "Niveau", "Durée"],
                  query.data!.map((a) => [
                    a.rank,
                    a.full_name,
                    a.agency,
                    `${a.score} / ${a.max_score}`,
                    levelLabel(a.level),
                    duration(a.duration_sec),
                  ]),
                ),
              )
            }
          >
            Exporter en PDF
          </button>
        </div>
        <p className="mt-1 muted">
          Classement par pourcentage décroissant, puis par durée croissante en
          cas d’égalité.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-sm text-slate-500">
              <th className="p-4">Rang</th>
              <th className="p-4">Candidat</th>
              <th className="p-4">Agence</th>
              <th className="p-4">Note</th>
              <th className="p-4">Niveau</th>
              <th className="p-4">Résultat</th>
              <th className="p-4">Durée</th>
              <th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((a) => (
              <tr className="border-t" key={a.id}>
                <td className="p-4">
                  <span
                    className={`inline-grid h-9 w-9 place-items-center rounded-full font-black ${a.rank === 1 ? "bg-amber-100 text-amber-800" : a.rank === 2 ? "bg-slate-200 text-slate-700" : a.rank === 3 ? "bg-orange-100 text-orange-800" : "bg-slate-50 text-slate-600"}`}
                  >
                    {a.rank}
                  </span>
                </td>
                <td className="p-4 font-bold">{a.full_name}</td>
                <td className="p-4">{a.agency}</td>
                <td className="p-4 text-lg font-black text-[#102d4e]">
                  {numberFr(a.score)} / {a.max_score}
                </td>
                <td className="p-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
                    {levelLabel(a.level)}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`font-bold ${a.passed ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {a.passed ? "Réussi" : "Non validé"}
                  </span>
                </td>
                <td className="p-4 whitespace-nowrap">
                  {duration(a.duration_sec)}
                </td>
                <td className="p-4 whitespace-nowrap">
                  {dateFr(a.submitted_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Admin() {
  const client = useQueryClient();
  const auth = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => adminGet("/api/auth/me"),
    retry: false,
  });
  const [view, setView] = useState<View>("overview");
  if (auth.isLoading)
    return (
      <main className="grid min-h-screen place-items-center">
        Vérification de la session…
      </main>
    );
  if (auth.isError)
    return (
      <Login
        onSuccess={() => {
          client.clear();
          void auth.refetch();
        }}
      />
    );
  const titles = {
    overview: ["Vue d’ensemble", "Pilotage de la formation"],
    candidates: ["Candidats", "Suivi des tentatives et des résultats"],
    questions: ["Analyse par question", "Compréhension et distracteurs"],
    agencies: ["Classement", "Classement des candidatures"],
  } as const;
  const navigation: [View, string][] = [
    ["overview", "Vue d’ensemble"],
    ["candidates", "Candidats"],
    ["questions", "Questions"],
    ["agencies", "Classement"],
  ];
  return (
    <div className="min-h-screen bg-[#eef3f8] lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="no-print bg-[#102f49] text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center gap-3 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-500 font-black">
            AV
          </span>
          <div>
            <strong className="text-xl">Assurance vie</strong>
            <p className="text-sm text-blue-200">Administration</p>
          </div>
        </div>
        <nav
          className="grid grid-cols-2 gap-1 sm:grid-cols-4 px-3 pb-3 lg:mt-8 lg:grid-cols-1"
          aria-label="Navigation administration"
        >
          {navigation.map(([key, label]) => (
            <button
              className={`min-h-12 rounded-lg px-3 text-left font-semibold transition-colors ${view === key ? "bg-white/15 text-white ring-1 ring-cyan-400" : "text-blue-100 hover:bg-white/10"}`}
              onClick={() => setView(key)}
              key={key}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-6 text-sm text-blue-100 lg:absolute lg:bottom-0 lg:block lg:w-full">
          <strong className="text-white">Administrateur</strong>
          <p>Espace formateur sécurisé</p>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-7 xl:p-10">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-cyan-700">
              {titles[view][1]}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-[#102d4e] sm:text-4xl">
              {titles[view][0]}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn border bg-white" href="/">
              Accueil
            </a>
            <button
              className="btn border bg-white"
              onClick={() =>
                void adminLogout()
                  .then(() => {
                    client.clear();
                    void auth.refetch();
                  })
                  .catch(() =>
                    window.alert("Déconnexion impossible. Réessayez."),
                  )
              }
            >
              Se déconnecter
            </button>
          </div>
        </header>
        {view === "overview" ? (
          <Overview />
        ) : view === "candidates" ? (
          <Candidates />
        ) : view === "questions" ? (
          <Questions />
        ) : (
          <Ranking />
        )}
      </main>
    </div>
  );
}
