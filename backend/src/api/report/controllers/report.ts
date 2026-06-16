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
    const { programId } = ctx.query as Record<string, string>;
    const rows = await strapi.db
      .query("api::tracer-session.tracer-session")
      .findMany({
        select: ["date"],
        where: programId ? { questionnaire: { program: Number(programId) } } : {},
        limit: 1000000,
      });
    const years = new Set<number>([new Date().getFullYear()]);
    for (const r of rows) {
      if (r.date) years.add(new Date(r.date).getFullYear());
    }
    ctx.body = { data: [...years].sort((a, b) => b - a) };
  },

  async summary(ctx) {
    const { from, to, departmentId, questionnaireId, auditorId, programId } = ctx.query as Record<
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
    else if (programId) where.questionnaire = { program: Number(programId) };
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
    // распределение ответов по каждому опроснику
    const qAns = new Map<number, { full: number; partial: number; none: number; na: number }>();

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

      if (!qAns.has(qk)) qAns.set(qk, { full: 0, partial: 0, none: 0, na: 0 });
      const ac = qAns.get(qk)!;
      for (const v of Object.values((sub.answers || {}) as Record<string, string>)) {
        if (ac[v as keyof typeof ac] !== undefined) ac[v as keyof typeof ac]++;
      }
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
      const a = qAns.get(qk) ?? { full: 0, partial: 0, none: 0, na: 0 };
      const appl = a.full + a.partial + a.none;
      return {
        id: qk || undefined,
        name: q.name,
        sessions: sessByQ.get(qk) ?? 0,
        departments: q.depts.size,
        avgPercent: avg(deptAvgs),
        full: a.full,
        partial: a.partial,
        none: a.none,
        problemPct: appl ? Math.round(((a.partial + a.none) / appl) * 1000) / 10 : 0,
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

    // распределение ответов: Соответствует / Частично / Не соответствует / Неприменим
    const answerCounts = { full: 0, partial: 0, none: 0, na: 0 } as Record<string, number>;
    for (const sub of subjects) {
      const ans = (sub.answers || {}) as Record<string, string>;
      for (const v of Object.values(ans)) {
        if (answerCounts[v] !== undefined) answerCounts[v]++;
      }
    }

    // по критериям + тепловая карта отдел×вопрос (только при выбранном опроснике)
    type Cnt = { full: number; partial: number; none: number; na: number };
    const emptyCnt = (): Cnt => ({ full: 0, partial: 0, none: 0, na: 0 });
    const compliance = (o: Cnt): number | null => {
      const appl = o.full + o.partial + o.none;
      return appl ? Math.round(((o.full + o.partial * 0.5) / appl) * 1000) / 10 : null;
    };
    let byCriterion: unknown[] = [];
    let heatmap: unknown = null;
    if (questionnaireId) {
      // метаданные критериев: снимки сессий → relation → плейсхолдер по id из ответов
      const critMeta = new Map<number, { text: string; kind: string; order: number }>();
      for (const s of sessions) {
        for (const c of (s.criteriaSnapshot ?? []) as {
          id: number;
          text: string;
          kind?: string;
          order?: number;
        }[]) {
          if (c?.id != null && !critMeta.has(c.id)) {
            critMeta.set(c.id, { text: c.text, kind: c.kind ?? "scored", order: c.order ?? 0 });
          }
        }
      }
      try {
        const qFull = await strapi.db
          .query("api::questionnaire.questionnaire")
          .findOne({ where: { id: Number(questionnaireId) }, populate: { criteria: true } });
        for (const c of qFull?.criteria ?? []) {
          if (!critMeta.has(c.id)) {
            critMeta.set(c.id, { text: c.text, kind: c.kind ?? "scored", order: c.order ?? 0 });
          }
        }
      } catch {
        /* relation может отсутствовать — игнорируем */
      }
      for (const sub of subjects) {
        for (const k of Object.keys(sub.answers || {})) {
          const id = Number(k);
          if (id && !critMeta.has(id)) critMeta.set(id, { text: `Вопрос #${id}`, kind: "scored", order: 9999 });
        }
      }
      const scored = [...critMeta.entries()]
        .filter(([, m]) => m.kind !== "input")
        .map(([id, m]) => ({ id, text: m.text, order: m.order }))
        .sort((a, b) => a.order - b.order);

      const cAgg = new Map<number, Cnt>();
      const dcAgg = new Map<string, Map<number, Cnt>>();
      for (const sub of subjects) {
        const ans = (sub.answers || {}) as Record<string, string>;
        const deptName = sub.session?.department?.name ?? sub.departmentSnapshot ?? "—";
        for (const c of scored) {
          const v = ans[c.id] ?? ans[String(c.id)];
          if (v === undefined || v === null) continue;
          if (!cAgg.has(c.id)) cAgg.set(c.id, emptyCnt());
          const o = cAgg.get(c.id)!;
          if (o[v as keyof Cnt] !== undefined) o[v as keyof Cnt]++;
          if (!dcAgg.has(deptName)) dcAgg.set(deptName, new Map());
          const dm = dcAgg.get(deptName)!;
          if (!dm.has(c.id)) dm.set(c.id, emptyCnt());
          const o2 = dm.get(c.id)!;
          if (o2[v as keyof Cnt] !== undefined) o2[v as keyof Cnt]++;
        }
      }

      byCriterion = scored
        .map((c) => {
          const o = cAgg.get(c.id) ?? emptyCnt();
          const appl = o.full + o.partial + o.none;
          return {
            id: c.id,
            text: c.text,
            full: o.full,
            partial: o.partial,
            none: o.none,
            na: o.na,
            compliancePct: compliance(o),
            problemPct: appl ? Math.round(((o.partial + o.none) / appl) * 1000) / 10 : 0,
          };
        })
        .filter((c) => c.full + c.partial + c.none > 0)
        .sort((a, b) => b.problemPct - a.problemPct || b.none - a.none);

      const depts = [...dcAgg.keys()];
      if (depts.length > 0 && scored.length > 0) {
        heatmap = {
          criteria: scored.map((c) => ({ id: c.id, text: c.text })),
          rows: depts.map((name) => ({
            name,
            cells: scored.map((c) => {
              const o = dcAgg.get(name)?.get(c.id) ?? emptyCnt();
              return { critId: c.id, compliancePct: compliance(o), none: o.none, partial: o.partial };
            }),
          })),
        };
      }
    }

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
        answerCounts,
        byCriterion,
        heatmap,
        monthly,
      },
    };
  },
};
