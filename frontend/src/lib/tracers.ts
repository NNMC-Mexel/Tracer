import { strapiFetch } from "./strapi";
import type { Paginated } from "./employees";

/** «na» — «неприменимо», в расчёт не входит. */
export type AnswerValue = "full" | "partial" | "none" | "na";

/** Веса оценок. «na» отсутствует — исключается из расчёта. */
export const ANSWER_WEIGHT: Record<string, number> = {
  full: 1,
  partial: 0.5,
  none: 0,
};

/** scored — оценочный (Да/Нет, в %); input — поле-вписка (текст/цифры, в % не входит). */
export type CriterionKind = "scored" | "input";

export interface Criterion {
  id: number;
  text: string;
  kind?: CriterionKind;
  order: number;
}

export type SubjectType = "department" | "employee";
/** Шкала ответов: 3 уровня (Соотв./Частично/Не соотв.) или Да/Нет. */
export type Scale = "three_level" | "binary";

export interface Program {
  id: number;
  name: string;
  slug: string;
}

export interface Questionnaire {
  id: number;
  documentId: string;
  slug: string;
  name: string;
  subjectType: SubjectType;
  scale: Scale;
  allowNa?: boolean;
  /** Глобальный список сотрудников (без привязки к отделу) — напр. тайм-аут. */
  globalSubjects?: boolean;
  program?: Program | null;
  description?: string;
  order: number;
  criteria: Criterion[];
}

/** Список опросников (активных) с критериями, по порядку. Можно фильтровать по направлению. */
export async function listQuestionnaires(programId?: number): Promise<Questionnaire[]> {
  const qs = new URLSearchParams();
  qs.set("filters[active][$eq]", "true");
  if (programId) qs.set("filters[program][id][$eq]", String(programId));
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
  /** Поля-вписки (kind=input): значения прочерков по каждому критерию: { критерийId: [v1, v2, ...] }. */
  inputs?: Record<number, string[]>;
  /** id загруженного фото проверки на месте. */
  photoId?: number;
  subjects: SubjectPayload[];
  participants?: ParticipantPayload[];
}

/** Разбивает текст критерия по прочеркам (___). N частей → N−1 прочерков. */
export function blankParts(text: string): string[] {
  return text.split(/_{2,}/);
}

/** Подставляет значения в прочерки для показа: «Из 10 проверенных … СПОР 7». */
export function fillBlanks(text: string, values?: string[]): string {
  const parts = blankParts(text);
  if (parts.length === 1) return values?.[0] ? `${text.trim()}: ${values[0]}` : text;
  return parts
    .map((seg, i) => seg + (i < parts.length - 1 ? (values?.[i] ?? "______") : ""))
    .join("");
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
