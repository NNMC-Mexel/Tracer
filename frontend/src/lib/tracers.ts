import { strapiFetch } from "./strapi";
import type { Paginated } from "./employees";

export type AnswerValue = "full" | "partial" | "none";

export const ANSWER_WEIGHT: Record<AnswerValue, number> = {
  full: 1,
  partial: 0.5,
  none: 0,
};

export interface Criterion {
  id: number;
  text: string;
  order: number;
}

export type SubjectType = "department" | "employee";

export interface Questionnaire {
  id: number;
  documentId: string;
  slug: string;
  name: string;
  subjectType: SubjectType;
  description?: string;
  order: number;
  criteria: Criterion[];
}

/** Список опросников (активных) с критериями, по порядку. */
export async function listQuestionnaires(): Promise<Questionnaire[]> {
  const qs = new URLSearchParams();
  qs.set("filters[active][$eq]", "true");
  qs.set("populate[criteria][sort][0]", "order:asc");
  qs.set("sort[0]", "order:asc");
  qs.set("pagination[pageSize]", "100");
  const res = await strapiFetch<Paginated<Questionnaire>>(`/api/questionnaires?${qs.toString()}`);
  return res.data;
}

export interface SubjectPayload {
  employeeId?: number;
  label?: string;
  position?: string;
  department?: string;
  answers: Record<number, AnswerValue>;
  notes?: Record<number, string>;
}

export interface ParticipantPayload {
  employeeId?: number;
  fullName?: string;
  position?: string;
}

export interface SubmitTracerInput {
  /** Если задан — обновляем существующий трейсер, иначе создаём новый. */
  sessionId?: number;
  questionnaireId: number;
  organizationId?: number;
  departmentId?: number;
  date?: string;
  time?: string;
  note?: string;
  subjects: SubjectPayload[];
  participants?: ParticipantPayload[];
}

export interface TracerSubjectResult {
  id: number;
  label?: string;
  positionSnapshot?: string;
  scorePercent: number;
  employee?: { id: number; fullName: string } | null;
}

export interface TracerSessionResult {
  id: number;
  documentId: string;
  date: string;
  time?: string;
  auditorName?: string;
  scorePercent: number;
  complianceLevel: "high" | "medium" | "low";
  subjects: TracerSubjectResult[];
}

/** Отправка проведённого трейсера. Сервер считает баллы и возвращает результат. */
export async function submitTracer(input: SubmitTracerInput): Promise<TracerSessionResult> {
  const res = await strapiFetch<{ data: TracerSessionResult }>(
    "/api/tracer-sessions/submit",
    { method: "POST", body: JSON.stringify({ data: input }) },
  );
  return res.data;
}

/** Удаление трейсера (вместе с субъектами — каскадом на сервере). */
export async function deleteTracer(documentId: string): Promise<void> {
  await strapiFetch(`/api/tracer-sessions/${documentId}`, { method: "DELETE" });
}

export const LEVEL_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: "Высокий", color: "green" },
  medium: { text: "Средний", color: "gold" },
  low: { text: "Низкий", color: "red" },
};
