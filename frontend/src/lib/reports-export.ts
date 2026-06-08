import type { Summary } from "./reports";

const LEVELS: Record<string, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

interface Meta {
  title: string;
  period: string;
}

// --- Excel (SheetJS) ----------------------------------------------------------

export async function exportSummaryExcel(summary: Summary, meta: Meta) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const kpi = [
    ["Отчёт", meta.title],
    ["Период", meta.period],
    [],
    ["Трейсеров", summary.kpi.sessions],
    ["Проверено сотрудников", summary.kpi.subjects],
    ["Средний % соответствия", summary.kpi.avgPercent],
    ["Высокий", summary.kpi.levelCounts.high],
    ["Средний", summary.kpi.levelCounts.medium],
    ["Низкий", summary.kpi.levelCounts.low],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpi), "Сводка");

  const dept = [
    ["Отдел", "Трейсеров", "Средний %", "Проверено", "Всего в отделе", "Охват %"],
    ...summary.byDepartment.map((d) => [
      d.name,
      d.sessions,
      d.avgPercent,
      d.auditedEmployees,
      d.totalEmployees ?? "",
      d.coverage ?? "",
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dept), "По отделам");

  const ques = [
    ["Опросник", "Трейсеров", "Средний %"],
    ...summary.byQuestionnaire.map((q) => [q.name, q.sessions, q.avgPercent]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ques), "По опросникам");

  const mon = [
    ["Месяц", "Трейсеров", "Средний %"],
    ...summary.monthly.map((m) => [m.month, m.sessions, m.avgPercent]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mon), "Динамика");

  XLSX.writeFile(wb, `Отчёт_${meta.period}.xlsx`);
}

export async function exportJournalExcel(
  rows: {
    date: string;
    questionnaire?: { name: string } | null;
    department?: { name: string } | null;
    auditorName?: string;
    scorePercent: number;
    complianceLevel: string;
  }[],
  period: string,
) {
  const XLSX = await import("xlsx");
  const data = [
    ["Дата", "Опросник", "Отдел", "Аудитор", "%", "Уровень"],
    ...rows.map((r) => [
      r.date,
      r.questionnaire?.name ?? "",
      r.department?.name ?? "",
      r.auditorName ?? "",
      r.scorePercent,
      LEVELS[r.complianceLevel] ?? r.complianceLevel,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Журнал");
  XLSX.writeFile(wb, `Журнал_${period}.xlsx`);
}

// --- PDF (pdfmake, шрифт Roboto поддерживает кириллицу) -----------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getPdfMake(): Promise<any> {
  const mod: any = await import("pdfmake/build/pdfmake");
  const pdfMake = mod.default ?? mod;
  const fontsMod: any = await import("pdfmake/build/vfs_fonts");
  const vfs =
    fontsMod.vfs ?? fontsMod.default?.vfs ?? fontsMod.pdfMake?.vfs ?? fontsMod.default;
  if (vfs && !pdfMake.vfs) pdfMake.vfs = vfs;
  return pdfMake;
}

export async function exportSummaryPdf(summary: Summary, meta: Meta) {
  const pdfMake = await getPdfMake();

  const deptBody = [
    ["Отдел", "Трейсеров", "Ср. %", "Охват %"],
    ...summary.byDepartment.map((d) => [
      d.name,
      String(d.sessions),
      String(d.avgPercent),
      d.coverage != null ? String(d.coverage) : "—",
    ]),
  ];
  const quesBody = [
    ["Опросник", "Трейсеров", "Ср. %"],
    ...summary.byQuestionnaire.map((q) => [q.name, String(q.sessions), String(q.avgPercent)]),
  ];

  const doc = {
    pageMargins: [30, 30, 30, 30] as [number, number, number, number],
    content: [
      { text: meta.title, style: "h1" },
      { text: `Период: ${meta.period}`, margin: [0, 0, 0, 10] },
      {
        columns: [
          { text: `Трейсеров: ${summary.kpi.sessions}` },
          { text: `Проверено: ${summary.kpi.subjects}` },
          { text: `Средний %: ${summary.kpi.avgPercent}` },
        ],
        margin: [0, 0, 0, 12],
      },
      { text: "По отделам", style: "h2" },
      {
        table: { headerRows: 1, widths: ["*", "auto", "auto", "auto"], body: deptBody },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 12],
      },
      { text: "По опросникам", style: "h2" },
      {
        table: { headerRows: 1, widths: ["*", "auto", "auto"], body: quesBody },
        layout: "lightHorizontalLines",
      },
    ],
    styles: {
      h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      h2: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] },
    },
    defaultStyle: { fontSize: 9 },
  };

  pdfMake.createPdf(doc).download(`Отчёт_${meta.period}.pdf`);
}
