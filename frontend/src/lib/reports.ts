import { strapiFetch } from "./strapi";
import type { Paginated } from "./employees";

export interface SummaryKpi {
  sessions: number;
  subjects: number;
  avgPercent: number;
  levelCounts: { high: number; medium: number; low: number };
}
export interface DeptStat {
  departmentId?: number;
  name: string;
  sessions: number;
  avgPercent: number;
  auditedEmployees: number;
  totalEmployees: number | null;
  coverage: number | null;
}
export interface QStat {
  id?: number;
  name: string;
  sessions: number;
  departments?: number;
  avgPercent: number;
}
export interface CategoryStat {
  category: string;
  subjects: number;
  avgPercent: number;
}
export interface EmployeeStat {
  employeeId: number;
  fullName: string;
  position?: string;
  category?: string;
  department: string;
  scorePercent: number;
}
export interface MonthStat {
  month: string;
  sessions: number;
  avgPercent: number;
}
export interface Summary {
  kpi: SummaryKpi;
  byDepartment: DeptStat[];
  byQuestionnaire: QStat[];
  byCategory: CategoryStat[];
  byEmployee: EmployeeStat[];
  monthly: MonthStat[];
}

export const CATEGORY_LABEL: Record<string, string> = {
  ВМР: "ВМР — врачи",
  СМР: "СМР — средний медперсонал",
  ММП: "ММП — младший медперсонал",
  ДР: "ДР — другой персонал",
};

export interface SummaryParams {
  from?: string;
  to?: string;
  departmentId?: number;
  questionnaireId?: number;
  auditorId?: number;
  programId?: number;
}

export async function getReportYears(programId?: number): Promise<number[]> {
  const qs = new URLSearchParams();
  if (programId) qs.set("programId", String(programId));
  const res = await strapiFetch<{ data: number[] }>(`/api/reports/years?${qs.toString()}`);
  return res.data;
}

export async function getSummary(params: SummaryParams): Promise<Summary> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.departmentId) qs.set("departmentId", String(params.departmentId));
  if (params.questionnaireId) qs.set("questionnaireId", String(params.questionnaireId));
  if (params.programId) qs.set("programId", String(params.programId));
  const res = await strapiFetch<{ data: Summary }>(`/api/reports/summary?${qs.toString()}`);
  return res.data;
}

// --- Журнал (история трейсеров) ----------------------------------------------

export interface JournalRow {
  id: number;
  documentId: string;
  date: string;
  time?: string;
  auditorName?: string;
  note?: string;
  scorePercent: number;
  complianceLevel: "high" | "medium" | "low";
  inputs?: Record<string, string>;
  criteriaSnapshot?: { id: number; text: string; order: number; kind?: string }[];
  participants?: { employeeId?: number; fullName?: string; position?: string }[];
  department?: { id: number; name: string } | null;
  questionnaire?: { id: number; name: string; slug: string; subjectType: string; scale?: string; allowNa?: boolean } | null;
  subjects?: {
    id: number;
    label?: string;
    positionSnapshot?: string;
    departmentSnapshot?: string;
    scorePercent: number;
    answers?: Record<string, string>;
    notes?: Record<string, string>;
    employee?: {
      id: number;
      fullName: string;
      position?: string;
      department?: { id: number; name: string } | null;
    } | null;
  }[];
}

export interface JournalParams extends SummaryParams {
  page?: number;
  pageSize?: number;
  auditor?: string;
}

export async function getJournal(
  params: JournalParams,
): Promise<Paginated<JournalRow>> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("filters[date][$gte]", params.from);
  if (params.to) qs.set("filters[date][$lte]", params.to);
  if (params.departmentId)
    qs.set("filters[department][id][$eq]", String(params.departmentId));
  if (params.questionnaireId)
    qs.set("filters[questionnaire][id][$eq]", String(params.questionnaireId));
  if (params.auditor && params.auditor.trim())
    qs.set("filters[auditorName][$containsi]", params.auditor.trim());
  if (params.programId)
    qs.set("filters[questionnaire][program][id][$eq]", String(params.programId));
  qs.set("populate[0]", "department");
  qs.set("populate[1]", "questionnaire");
  qs.set("sort[0]", "date:desc");
  qs.set("pagination[page]", String(params.page ?? 1));
  qs.set("pagination[pageSize]", String(params.pageSize ?? 20));
  return strapiFetch<Paginated<JournalRow>>(`/api/tracer-sessions?${qs.toString()}`);
}

export async function getSessionDetail(documentId: string): Promise<JournalRow> {
  // Единый объектный стиль populate (нельзя мешать массив и объект — Strapi теряет часть связей).
  const qs = new URLSearchParams();
  qs.set("populate[department]", "true");
  qs.set("populate[questionnaire]", "true");
  qs.set("populate[subjects][populate][employee][populate][department]", "true");
  const res = await strapiFetch<{ data: JournalRow }>(
    `/api/tracer-sessions/${documentId}?${qs.toString()}`,
  );
  return res.data;
}

export const MONTH_NAMES = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
export function monthLabel(ym: string): string {
  const [, m] = ym.split("-");
  return MONTH_NAMES[Number(m) - 1] ?? ym;
}
