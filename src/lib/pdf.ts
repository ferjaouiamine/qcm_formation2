import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Correction } from "../types/quiz";
const clean = (value: unknown) =>
  String(value ?? "—")
    .replaceAll("≥", ">=")
    .replaceAll("→", ">")
    .replaceAll("✓", "OK");
export function exportTable(
  title: string,
  headers: string[],
  rows: unknown[][],
  subtitle = "Formation assurance vie",
) {
  const doc = new jsPDF({
    orientation: headers.length > 5 ? "landscape" : "portrait",
  });
  doc.setFontSize(18);
  doc.setTextColor(16, 45, 78);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(clean(subtitle), 14, 28);
  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: rows.map((row) => row.map(clean)),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [16, 45, 78] },
    margin: { bottom: 18 },
    didDrawPage: () => {
      doc.setFontSize(9);
      doc.text(
        `Formation assurance vie · Page ${doc.getNumberOfPages()}`,
        14,
        doc.internal.pageSize.getHeight() - 8,
      );
    },
  });
  doc.save("formation-assurance-vie.pdf");
}
export function exportResult(r: {
  full_name: string;
  agency: string;
  score: number | null;
  max_score: number;
  correction?: Correction[];
  answers?: Correction[];
}) {
  const rows = (r.correction ?? r.answers ?? []).map((q) => [
    `${q.position}. ${q.text}`,
    q.options.find((o) => o.id === q.selected)?.label ?? "Sans réponse",
    q.options.find((o) => o.id === q.correct)?.label ?? "",
    q.is_correct ? "1" : "0",
    q.explanation,
  ]);
  exportTable(
    "Résultat et correction",
    [
      "Question",
      "Réponse du candidat",
      "Bonne réponse",
      "Point",
      "Justification",
    ],
    rows,
    `${r.full_name} · ${r.agency} · Note : ${r.score ?? "En cours"} / ${r.max_score}`,
  );
}
