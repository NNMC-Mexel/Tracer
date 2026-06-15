import { factories } from "@strapi/strapi";

/** Веса ответов для расчёта процента соответствия. */
const WEIGHT: Record<string, number> = { full: 1, partial: 0.5, none: 0 };

/** Порог уровня соответствия (можно вынести в настройки позже). */
function complianceLevel(pct: number): "high" | "medium" | "low" {
  if (pct >= 85) return "high";
  if (pct >= 60) return "medium";
  return "low";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const TS = "api::tracer-session.tracer-session";
const TSUB = "api::tracer-subject.tracer-subject";

interface SubjectInput {
  employeeId?: number;
  label?: string;
  position?: string;
  department?: string;
  answers?: Record<string, string>;
  notes?: Record<string, string>;
}

export default factories.createCoreController(TS, ({ strapi }) => ({
  /**
   * Создаёт или обновляет трейсер вместе с субъектами и считает результат на сервере.
   * POST /api/tracer-sessions/submit  (передать sessionId — будет обновление)
   */
  async submit(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const body = (ctx.request.body as { data?: unknown })?.data ?? ctx.request.body;
    const {
      sessionId,
      questionnaireId,
      organizationId,
      departmentId,
      date,
      time,
      note,
      subjects,
      participants,
      inputs,
      photoId,
    } = (body ?? {}) as {
      sessionId?: number;
      questionnaireId?: number;
      organizationId?: number;
      departmentId?: number;
      date?: string;
      time?: string;
      note?: string;
      subjects?: SubjectInput[];
      participants?: unknown[];
      inputs?: Record<string, string>;
      photoId?: number;
    };

    if (!questionnaireId) return ctx.badRequest("questionnaireId обязателен");
    if (!Array.isArray(subjects) || subjects.length === 0)
      return ctx.badRequest("Нужен хотя бы один субъект (subjects)");

    const questionnaire = await strapi.db
      .query("api::questionnaire.questionnaire")
      .findOne({ where: { id: questionnaireId }, populate: { criteria: true } });
    if (!questionnaire) return ctx.badRequest("Опросник не найден");

    const criteria = [...(questionnaire.criteria ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    // оценочные критерии (kind=input — поля-вписки, в расчёт не входят)
    const scored = criteria.filter((c) => c.kind !== "input");
    const snapshot = criteria.map((c) => ({
      id: c.id,
      text: c.text,
      order: c.order,
      kind: c.kind ?? "scored",
    }));

    const computed = subjects.map((s) => {
      let sum = 0;
      let applicable = 0;
      for (const c of scored) {
        const v = (s.answers?.[c.id] ?? s.answers?.[String(c.id)]) as string;
        if (v === "na") continue; // «не применимо» — вне расчёта
        applicable++;
        sum += WEIGHT[v] ?? 0;
      }
      const pct = applicable ? round1((sum / applicable) * 100) : 0;
      return { input: s, pct };
    });
    const sessionPct = computed.length
      ? round1(computed.reduce((acc, c) => acc + c.pct, 0) / computed.length)
      : 0;

    const data: Record<string, unknown> = {
      questionnaire: questionnaire.id,
      organization: organizationId ?? null,
      department: departmentId ?? null,
      date: date ?? new Date().toISOString().slice(0, 10),
      time: time ?? null,
      note: note ?? null,
      criteriaSnapshot: snapshot,
      inputs: inputs && typeof inputs === "object" ? inputs : {},
      ...(photoId ? { photo: photoId } : {}),
      participants: Array.isArray(participants) ? participants : [],
      scorePercent: sessionPct,
      complianceLevel: complianceLevel(sessionPct),
    };

    let session;
    if (sessionId) {
      const existing = await strapi.db.query(TS).findOne({ where: { id: sessionId } });
      if (!existing) return ctx.notFound("Трейсер не найден");
      // пересоздаём субъектов
      await strapi.db.query(TSUB).deleteMany({ where: { session: sessionId } });
      session = await strapi.db.query(TS).update({ where: { id: sessionId }, data });
    } else {
      session = await strapi.db
        .query(TS)
        .create({ data: { ...data, auditor: user.id, auditorName: user.username } });
    }

    for (const c of computed) {
      await strapi.db.query(TSUB).create({
        data: {
          session: session.id,
          employee: c.input.employeeId ?? null,
          label: c.input.label ?? null,
          positionSnapshot: c.input.position ?? null,
          departmentSnapshot: c.input.department ?? null,
          answers: c.input.answers ?? {},
          notes: c.input.notes ?? {},
          scorePercent: c.pct,
        },
      });
    }

    const full = await strapi.db.query(TS).findOne({
      where: { id: session.id },
      populate: {
        subjects: { populate: { employee: true } },
        questionnaire: true,
        department: true,
        organization: true,
      },
    });

    ctx.body = { data: full };
  },

  /**
   * Удаление трейсера вместе с его субъектами (каскад).
   * DELETE /api/tracer-sessions/:documentId
   */
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id: documentId } = ctx.params;
    const session = await strapi.db.query(TS).findOne({ where: { documentId } });
    if (!session) return ctx.notFound("Трейсер не найден");

    await strapi.db.query(TSUB).deleteMany({ where: { session: session.id } });
    await strapi.db.query(TS).delete({ where: { id: session.id } });

    ctx.body = { data: { id: session.id, documentId } };
  },
}));
