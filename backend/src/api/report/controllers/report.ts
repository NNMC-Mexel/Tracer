/**
 * Отчёты: агрегированная статистика по трейсерам.
 * GET /api/reports/years   — годы, по которым есть данные
 * GET /api/reports/summary — сводка за период (фильтры: from, to, departmentId, questionnaireId, auditorId)
 *
 * Логика %:
 *  - внутри отдела: средний % по проверенным сотрудникам отдела;
 *  - общий % по опроснику/периоду: среднее по отделам (каждый отдел весит одинаково).
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
      .findMany({ select: ["date"], limit: 1000000 });
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

    const sessions = await strapi.db.query("api::tracer-session.tracer-session").findMany({
      where,
      populate: { department: true, questionnaire: true },
      orderBy: { date: "asc" },
      limit: 1000000,
    });

    // уровни и число листов
    const levelCounts = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    sessions.forEach((s) => {
      if (s.complianceLevel && levelCounts[s.complianceLevel] !== undefined)
        levelCounts[s.complianceLevel]++;
    });

    // число сессий (листов) по отделам и по опросникам
    const sessByDept = new Map<number, number>();
    const sessByQ = new Map<number, number>();
    const byMonthMap = new Map<string, { scores: Num[]; sessions: number }>();
    for (const s of sessions) {
      sessByDept.set(s.department?.id ?? 0, (sessByDept.get(s.department?.id ?? 0) ?? 0) + 1);
      sessByQ.set(s.questionnaire?.id ?? 0, (sessByQ.get(s.questionnaire?.id ?? 0) ?? 0) + 1);
      const m = String(s.date ?? "").slice(0, 7);
      if (m) {
        if (!byMonthMap.has(m)) byMonthMap.set(m, { scores: [], sessions: 0 });
        const mb = byMonthMap.get(m)!;
        mb.scores.push(s.scorePercent);
        mb.sessions++;
      }
    }

    // все субъекты (в т.ч. чек-листы, где employee = null)
    const sessionIds = sessions.map((s) => s.id);
    const subjects = sessionIds.length
      ? await strapi.db.query("api::tracer-subject.tracer-subject").findMany({
          where: { session: { id: { $in: sessionIds } } },
          populate: {
            session: { populate: { department: true, questionnaire: true } },
            employee: true,
          },
          limit: 1000000,
        })
      : [];

    // агрегаты из субъектов
    const subjByDept = new Map<number, { name: string; scores: Num[] }>();
    const auditedByDept = new Map<number, Set<number>>();
    const qByDept = new Map<number, { name: string; depts: Map<number, Num[]> }>();

    for (const sub of subjects) {
      const dk = sub.session?.department?.id ?? 0;
      const dn = sub.session?.department?.name ?? "—";
      const qk = sub.session?.questionnaire?.id ?? 0;
      const qn = sub.session?.questionnaire?.name ?? "—";

      if (!subjByDept.has(dk)) subjByDept.set(dk, { name: dn, scores: [] });
      subjByDept.get(dk)!.scores.push(sub.scorePercent);

      if (sub.employee?.id) {
        if (!auditedByDept.has(dk)) auditedByDept.set(dk, new Set());
        auditedByDept.get(dk)!.add(sub.employee.id);
      }

      if (!qByDept.has(qk)) qByDept.set(qk, { name: qn, depts: new Map() });
      const depts = qByDept.get(qk)!.depts;
      if (!depts.has(dk)) depts.set(dk, []);
      depts.get(dk)!.push(sub.scorePercent);
    }

    // по отделам: средний % по сотрудникам + охват
    const byDepartment = [];
    for (const [dk, b] of subjByDept) {
      let totalEmployees: number | null = null;
      let coverage: number | null = null;
      const audited = dk ? auditedByDept.get(dk)?.size ?? 0 : 0;
      if (dk) {
        totalEmployees = await strapi.db
          .query("api::employee.employee")
          .count({ where: { department: dk, active: true } });
        coverage = totalEmployees ? Math.round((audited / totalEmployees) * 1000) / 10 : null;
      }
      byDepartment.push({
        departmentId: dk || undefined,
        name: b.name,
        sessions: sessByDept.get(dk) ?? 0,
        avgPercent: avg(b.scores),
        auditedEmployees: audited,
        totalEmployees,
        coverage,
      });
    }
    byDepartment.sort((a, b) => b.avgPercent - a.avgPercent);

    // общий % = среднее по отделам (каждый отдел весит одинаково)
    const avgPercent = avg(byDepartment.map((d) => d.avgPercent));

    // по опросникам: среднее по отделам этого опросника
    const byQuestionnaire = [...qByDept.entries()].map(([qk, q]) => {
      const deptAvgs = [...q.depts.values()].map((arr) => avg(arr));
      return {
        id: qk || undefined,
        name: q.name,
        sessions: sessByQ.get(qk) ?? 0,
        departments: q.depts.size,
        avgPercent: avg(deptAvgs),
      };
    });

    const monthly = [...byMonthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, b]) => ({ month, sessions: b.sessions, avgPercent: avg(b.scores) }));

    // по категориям персонала (только сотрудники)
    const byCatMap = new Map<string, { scores: Num[]; count: number }>();
    for (const sub of subjects) {
      if (!sub.employee?.id) continue;
      const cat = sub.employee?.category || "—";
      if (!byCatMap.has(cat)) byCatMap.set(cat, { scores: [], count: 0 });
      const o = byCatMap.get(cat)!;
      o.scores.push(sub.scorePercent);
      o.count++;
    }
    const CAT_ORDER = ["ВМР", "СМР", "ММП", "ДР"];
    const byCategory = [...byCatMap.entries()]
      .map(([category, o]) => ({ category, subjects: o.count, avgPercent: avg(o.scores) }))
      .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));

    // детализация по сотрудникам (только при выбранном опроснике)
    const byEmployee = questionnaireId
      ? subjects
          .filter((s) => s.employee?.id)
          .map((s) => ({
            employeeId: s.employee.id,
            fullName: s.employee.fullName ?? s.label ?? "—",
            position: s.employee.position ?? s.positionSnapshot ?? "",
            category: s.employee.category ?? "",
            department: s.session?.department?.name ?? s.departmentSnapshot ?? "—",
            scorePercent: s.scorePercent,
          }))
          .sort((a, b) => Number(a.scorePercent) - Number(b.scorePercent))
      : [];

    ctx.body = {
      data: {
        kpi: {
          sessions: sessions.length,
          subjects: subjects.filter((s) => s.employee?.id).length,
          avgPercent,
          levelCounts,
        },
        byDepartment,
        byQuestionnaire,
        byCategory,
        byEmployee,
        monthly,
      },
    };
  },
};
