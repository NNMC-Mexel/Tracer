/**
 * Отчёты: агрегированная статистика по трейсерам.
 * GET /api/reports/years   — годы, по которым есть данные
 * GET /api/reports/summary — сводка за период (фильтры: from, to, departmentId, questionnaireId, auditorId)
 */

type Num = number | string | null | undefined;

function avg(nums: Num[]): number {
  const vals = nums.map((n) => Number(n ?? 0));
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export default {
  async years(ctx) {
    const rows = await strapi.db
      .query("api::tracer-session.tracer-session")
      .findMany({ select: ["date"], limit: -1 });
    const years = new Set<number>([new Date().getFullYear()]);
    for (const r of rows) {
      if (r.date) years.add(new Date(r.date).getFullYear());
    }
    ctx.body = { data: [...years].sort((a, b) => b - a) };
  },

  async summary(ctx) {
    const { from, to, departmentId, questionnaireId, auditorId } = ctx.query as Record<
      string,
      string
    >;

    const where: Record<string, unknown> = {};
    if (from || to) {
      const d: Record<string, string> = {};
      if (from) d.$gte = from;
      if (to) d.$lte = to;
      where.date = d;
    }
    if (departmentId) where.department = Number(departmentId);
    if (questionnaireId) where.questionnaire = Number(questionnaireId);
    if (auditorId) where.auditor = Number(auditorId);

    const sessions = await strapi.db
      .query("api::tracer-session.tracer-session")
      .findMany({
        where,
        populate: { department: true, questionnaire: true },
        orderBy: { date: "asc" },
        limit: -1,
      });

    // KPI
    const avgPercent = avg(sessions.map((s) => s.scorePercent));
    const levelCounts = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    sessions.forEach((s) => {
      if (s.complianceLevel && levelCounts[s.complianceLevel] !== undefined)
        levelCounts[s.complianceLevel]++;
    });

    // группировки
    type Bucket = { scores: Num[]; sessions: number };
    const byDept = new Map<number, Bucket & { departmentId?: number; name: string }>();
    const byQ = new Map<number, Bucket & { id?: number; name: string }>();
    const byMonth = new Map<string, Bucket & { month: string }>();

    for (const s of sessions) {
      const dKey = s.department?.id ?? 0;
      if (!byDept.has(dKey))
        byDept.set(dKey, { departmentId: s.department?.id, name: s.department?.name ?? "—", scores: [], sessions: 0 });
      const db = byDept.get(dKey)!;
      db.scores.push(s.scorePercent);
      db.sessions++;

      const qKey = s.questionnaire?.id ?? 0;
      if (!byQ.has(qKey))
        byQ.set(qKey, { id: s.questionnaire?.id, name: s.questionnaire?.name ?? "—", scores: [], sessions: 0 });
      const qb = byQ.get(qKey)!;
      qb.scores.push(s.scorePercent);
      qb.sessions++;

      const m = String(s.date ?? "").slice(0, 7);
      if (m) {
        if (!byMonth.has(m)) byMonth.set(m, { month: m, scores: [], sessions: 0 });
        const mb = byMonth.get(m)!;
        mb.scores.push(s.scorePercent);
        mb.sessions++;
      }
    }

    // субъекты (проверенные люди) для подсчёта охвата
    const sessionIds = sessions.map((s) => s.id);
    const subjects = sessionIds.length
      ? await strapi.db.query("api::tracer-subject.tracer-subject").findMany({
          where: { session: { id: { $in: sessionIds } }, employee: { id: { $notNull: true } } },
          populate: { session: { populate: { department: true } }, employee: true },
          limit: -1,
        })
      : [];

    // distinct проверенные сотрудники по отделам
    const auditedByDept = new Map<number, Set<number>>();
    for (const sub of subjects) {
      const dId = sub.session?.department?.id ?? 0;
      if (!auditedByDept.has(dId)) auditedByDept.set(dId, new Set());
      if (sub.employee?.id) auditedByDept.get(dId)!.add(sub.employee.id);
    }

    const byDepartment = [];
    for (const b of byDept.values()) {
      let totalEmployees: number | null = null;
      let coverage: number | null = null;
      const audited = b.departmentId ? auditedByDept.get(b.departmentId)?.size ?? 0 : 0;
      if (b.departmentId) {
        totalEmployees = await strapi.db
          .query("api::employee.employee")
          .count({ where: { department: b.departmentId, active: true } });
        coverage = totalEmployees ? Math.round((audited / totalEmployees) * 1000) / 10 : null;
      }
      byDepartment.push({
        departmentId: b.departmentId,
        name: b.name,
        sessions: b.sessions,
        avgPercent: avg(b.scores),
        auditedEmployees: audited,
        totalEmployees,
        coverage,
      });
    }
    byDepartment.sort((a, b) => b.sessions - a.sessions);

    const byQuestionnaire = [...byQ.values()].map((b) => ({
      id: b.id,
      name: b.name,
      sessions: b.sessions,
      avgPercent: avg(b.scores),
    }));

    const monthly = [...byMonth.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((b) => ({ month: b.month, sessions: b.sessions, avgPercent: avg(b.scores) }));

    ctx.body = {
      data: {
        kpi: {
          sessions: sessions.length,
          subjects: subjects.length,
          avgPercent,
          levelCounts,
        },
        byDepartment,
        byQuestionnaire,
        monthly,
      },
    };
  },
};
