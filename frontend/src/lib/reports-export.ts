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

  const cat = [
    ["Категория", "Проверено", "Средний %"],
    ...summary.byCategory.map((c) => [c.category, c.subjects, c.avgPercent]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cat), "По категориям");

  const mon = [
    ["Месяц", "Трейсеров", "Средний %"],
    ...summary.monthly.map((m) => [m.month, m.sessions, m.avgPercent]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mon), "Динамика");

  if (summary.byEmployee.length > 0) {
    const emp = [
      ["ФИО", "Должность", "Отдел", "Категория", "%"],
      ...summary.byEmployee.map((e) => [
        e.fullName,
        e.position ?? "",
        e.department,
        e.category ?? "",
        e.scorePercent,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(emp), "По сотрудникам");
  }

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

const CAT_FULL: Record<string, string> = {
  ВМР: "ВМР — врачи",
  СМР: "СМР — средний медперсонал",
  ММП: "ММП — младший медперсонал",
  ДР: "ДР — другой персонал",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function exportSummaryPdf(summary: Summary, meta: Meta) {
  const pdfMake = await getPdfMake();

  const ACCENT = "#1677ff";
  const pctColor = (v: number) => (v >= 85 ? "#389e0d" : v >= 60 ? "#d48806" : "#cf1322");
  const pct = (v: number) => ({ text: `${v}%`, color: pctColor(v), bold: true });
  const th = (t: string, align: "left" | "center" | "right" = "left") => ({
    text: t,
    bold: true,
    color: "white",
    fontSize: 9,
    alignment: align,
  });

  const tableLayout = {
    fillColor: (rowIndex: number) =>
      rowIndex === 0 ? ACCENT : rowIndex % 2 === 0 ? "#f5f8ff" : null,
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => "#e0e0e0",
    vLineColor: () => "#e0e0e0",
    paddingTop: () => 4,
    paddingBottom: () => 4,
  };

  const block = (title: string, headers: any[], widths: any[], rows: any[][]) => [
    { text: title, style: "h2" },
    {
      table: { headerRows: 1, widths, body: [headers, ...rows] },
      layout: tableLayout,
      margin: [0, 2, 0, 14],
    },
  ];

  const content: any[] = [
    { text: meta.title, style: "h1" },
    { text: `Период: ${meta.period}`, color: "#888", margin: [0, 0, 0, 6] },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 1.5, lineColor: ACCENT }],
      margin: [0, 0, 0, 12],
    },
    {
      table: {
        widths: ["*", "*", "*"],
        body: [
          [
            { stack: [{ text: String(summary.kpi.sessions), style: "kpiVal" }, { text: "Трейсеров", style: "kpiLabel" }], margin: [8, 6, 8, 6] },
            { stack: [{ text: String(summary.kpi.subjects), style: "kpiVal" }, { text: "Проверено сотрудников", style: "kpiLabel" }], margin: [8, 6, 8, 6] },
            { stack: [{ text: `${summary.kpi.avgPercent}%`, style: "kpiVal", color: pctColor(summary.kpi.avgPercent) }, { text: "Средний % (по отделам)", style: "kpiLabel" }], margin: [8, 6, 8, 6] },
          ],
        ],
      },
      layout: { fillColor: () => "#eef3fb", hLineWidth: () => 0, vLineWidth: () => 2, vLineColor: () => "#ffffff" },
      margin: [0, 0, 0, 16],
    },
  ];

  if (summary.byDepartment.length) {
    content.push(
      ...block(
        "По отделам",
        [th("Отдел"), th("Трейсеров", "center"), th("Ср. %", "center"), th("Охват %", "center")],
        ["*", "auto", "auto", "auto"],
        summary.byDepartment.map((d) => [
          d.name,
          { text: String(d.sessions), alignment: "center" },
          { ...pct(d.avgPercent), alignment: "center" },
          { text: d.coverage != null ? `${d.coverage}%` : "—", alignment: "center" },
        ]),
      ),
    );
  }

  if (summary.byCategory.length) {
    content.push(
      ...block(
        "По категориям персонала",
        [th("Категория"), th("Проверено", "center"), th("Ср. %", "center")],
        ["*", "auto", "auto"],
        summary.byCategory.map((c) => [
          CAT_FULL[c.category] ?? c.category,
          { text: String(c.subjects), alignment: "center" },
          { ...pct(c.avgPercent), alignment: "center" },
        ]),
      ),
    );
  }

  if (summary.answerCounts) {
    const ac = summary.answerCounts;
    const tot = ac.full + ac.partial + ac.none + ac.na;
    if (tot > 0) {
      const p = (n: number) => `${Math.round((n / tot) * 1000) / 10}%`;
      const rows: any[][] = [
        ["Соответствует", String(ac.full), p(ac.full)],
        ["Частично", String(ac.partial), p(ac.partial)],
        ["Не соответствует", String(ac.none), p(ac.none)],
      ];
      if (ac.na) rows.push(["Неприменим", String(ac.na), p(ac.na)]);
      content.push(
        ...block(
          "Распределение ответов",
          [th("Оценка"), th("Кол-во", "center"), th("Доля", "center")],
          ["*", "auto", "auto"],
          rows.map((r) => [r[0], { text: r[1], alignment: "center" }, { text: r[2], alignment: "center" }]),
        ),
      );
    }
  }

  if (summary.byEmployee.length) {
    content.push(
      ...block(
        "По сотрудникам",
        [th("ФИО"), th("Должность"), th("Отдел"), th("Кат.", "center"), th("%", "center")],
        ["*", "auto", "auto", "auto", "auto"],
        summary.byEmployee.map((e) => [
          e.fullName,
          e.position ?? "",
          e.department,
          { text: e.category ?? "", alignment: "center" },
          { ...pct(e.scorePercent), alignment: "center" },
        ]),
      ),
    );
  } else if (summary.byQuestionnaire.length > 1) {
    content.push(
      ...block(
        "По опросникам",
        [th("Опросник"), th("Отделов", "center"), th("Трейсеров", "center"), th("Ср. %", "center")],
        ["*", "auto", "auto", "auto"],
        summary.byQuestionnaire.map((q) => [
          q.name,
          { text: String(q.departments ?? ""), alignment: "center" },
          { text: String(q.sessions), alignment: "center" },
          { ...pct(q.avgPercent), alignment: "center" },
        ]),
      ),
    );
  }

  const doc = {
    pageMargins: [30, 30, 30, 40] as [number, number, number, number],
    content,
    footer: (page: number, count: number) => ({
      text: `Стр. ${page} из ${count}`,
      alignment: "center",
      fontSize: 8,
      color: "#999",
      margin: [0, 10, 0, 0],
    }),
    styles: {
      h1: { fontSize: 16, bold: true, color: "#222", margin: [0, 0, 0, 2] },
      h2: { fontSize: 12, bold: true, color: ACCENT, margin: [0, 4, 0, 4] },
      kpiVal: { fontSize: 18, bold: true },
      kpiLabel: { fontSize: 8, color: "#666" },
    },
    defaultStyle: { fontSize: 9 },
  };

  pdfMake.createPdf(doc).download(`Отчёт_${meta.period}.pdf`);
}
