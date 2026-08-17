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

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function positiveInt(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, ys, ms, ds] = match;
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  return (ty - fy) * 12 + tm - fm + 1;
}

function validatePeriod(ctx, from?: string, to?: string): boolean {
  if ((from && !validIsoDate(from)) || (to && !validIsoDate(to))) {
    ctx.badRequest("from и to должны быть календарными датами в формате YYYY-MM-DD");
    return false;
  }
  if (from && to) {
    if (from > to) {
      ctx.badRequest("from не может быть позже to");
      return false;
    }
    if (monthSpan(from, to) > 24) {
      ctx.badRequest("Период отчёта не может превышать 24 месяца");
      return false;
    }
  }
  return true;
}

async function reportProgramId(ctx): Promise<number | null> {
  const userId = ctx.state?.user?.id;
  if (!userId) {
    ctx.unauthorized();
    return null;
  }
  const user = await strapi.db.query("plugin::users-permissions.user").findOne({
    where: { id: userId },
    populate: { program: true },
  });
  const programId = user?.program?.id;
  if (!programId) {
    ctx.forbidden("Пользователю не назначено направление аудита");
    return null;
  }
  return programId;
}

async function questionnaireInProgram(ctx, questionnaireId: number, programId: number) {
  const questionnaire = await strapi.db.query("api::questionnaire.questionnaire").findOne({
    where: { id: questionnaireId },
    populate: { program: true },
  });
  if (!questionnaire || questionnaire.program?.id !== programId) {
    ctx.forbidden("Трейсер не относится к направлению текущего пользователя");
    return null;
  }
  return questionnaire;
}

function avg(nums: Num[]): number {
  const vals = nums.map((n) => Number(n ?? 0));
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** Список месяцев "YYYY-MM" от fromDate до toDate включительно (не более 24). */
export function monthsBetween(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  const [fy, fm] = fromDate.slice(0, 7).split("-").map(Number);
  const [ty, tm] = toDate.slice(0, 7).split("-").map(Number);
  let y = fy;
  let m = fm;
  let guard = 0;
  while ((y < ty || (y === ty && m <= tm)) && guard < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guard++;
  }
  return out;
}

/** Классификация тренда по ряду значений соответствия (в хронологии). */
export function classifyTrend(pts: number[]): string {
  if (pts.length < 2) return "insufficient";
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.every((p) => p < 60)) return "persistent"; // держится нарушение
  if (last - first >= 15 && last >= 60) return "improving"; // исправляются
  if (first - last >= 15) return "worsening"; // ухудшение
  return "stable";
}

export default {
  async years(ctx) {
    const programId = await reportProgramId(ctx);
    if (!programId) return;
    const rows = await strapi.db
      .query("api::tracer-session.tracer-session")
      .findMany({
        select: ["date"],
        where: { questionnaire: { program: programId } },
        limit: 1000000,
      });
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

    if (!validatePeriod(ctx, from, to)) return;
    const programId = await reportProgramId(ctx);
    if (!programId) return;
    const qId = questionnaireId ? positiveInt(questionnaireId) : null;
    const dId = departmentId ? positiveInt(departmentId) : null;
    const aId = auditorId ? positiveInt(auditorId) : null;
    if ((questionnaireId && !qId) || (departmentId && !dId) || (auditorId && !aId))
      return ctx.badRequest("Идентификаторы фильтров должны быть положительными целыми числами");
    if (qId && !(await questionnaireInProgram(ctx, qId, programId))) return;

    const where: Record<string, unknown> = { questionnaire: { program: programId } };
    if (from || to) {
      const d: Record<string, string> = {};
      if (from) d.$gte = from;
      if (to) d.$lte = to;
      where.date = d;
    }
    if (dId) where.department = dId;
    if (qId) where.questionnaire = qId;
    if (aId) where.auditor = aId;

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
    if (qId) {
      // метаданные критериев: снимки сессий → relation → плейсхолдер по id из ответов
      const critMeta = new Map<number, { text: string; kind: string; order: number; invert: boolean }>();
      for (const s of sessions) {
        for (const c of (s.criteriaSnapshot ?? []) as {
          id: number;
          text: string;
          kind?: string;
          order?: number;
          invert?: boolean;
        }[]) {
          if (c?.id != null && !critMeta.has(c.id)) {
            critMeta.set(c.id, { text: c.text, kind: c.kind ?? "scored", order: c.order ?? 0, invert: !!c.invert });
          }
        }
      }
      try {
        const qFull = await strapi.db
          .query("api::questionnaire.questionnaire")
          .findOne({ where: { id: qId }, populate: { criteria: true } });
        for (const c of qFull?.criteria ?? []) {
          if (!critMeta.has(c.id)) {
            critMeta.set(c.id, { text: c.text, kind: c.kind ?? "scored", order: c.order ?? 0, invert: !!c.invert });
          }
        }
      } catch {
        /* relation может отсутствовать — игнорируем */
      }
      for (const sub of subjects) {
        for (const k of Object.keys(sub.answers || {})) {
          const id = Number(k);
          if (id && !critMeta.has(id)) critMeta.set(id, { text: `Вопрос #${id}`, kind: "scored", order: 9999, invert: false });
        }
      }
      const scored = [...critMeta.entries()]
        .filter(([, m]) => m.kind !== "input")
        .map(([id, m]) => ({ id, text: m.text, order: m.order, invert: m.invert }))
        .sort((a, b) => a.order - b.order);

      // для обратных критериев меняем «Да»↔«Нет», чтобы «соответствие» = хороший ответ
      const norm = (v: string, invert: boolean) =>
        invert ? (v === "full" ? "none" : v === "none" ? "full" : v) : v;

      const cAgg = new Map<number, Cnt>();
      const dcAgg = new Map<string, Map<number, Cnt>>();
      for (const sub of subjects) {
        const ans = (sub.answers || {}) as Record<string, string>;
        const deptName = sub.session?.department?.name ?? sub.departmentSnapshot ?? "—";
        for (const c of scored) {
          const raw = ans[c.id] ?? ans[String(c.id)];
          if (raw === undefined || raw === null) continue;
          const v = norm(raw, c.invert);
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
    const byEmployee = qId
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

  /**
   * Динамика по месяцам: как меняется соответствие по каждому пункту трейсера
   * и по каждому отделу. Показывает, где нарушение держится, где исправились.
   * GET /api/reports/dynamics?questionnaireId&from&to&departmentId
   */
  async dynamics(ctx) {
    const { from, to, departmentId, questionnaireId } = ctx.query as Record<string, string>;
    if (!questionnaireId) return ctx.badRequest("questionnaireId обязателен");

    if (!validatePeriod(ctx, from, to)) return;
    const qId = positiveInt(questionnaireId);
    const dId = departmentId ? positiveInt(departmentId) : null;
    if (!qId || (departmentId && !dId))
      return ctx.badRequest("Идентификаторы фильтров должны быть положительными целыми числами");
    const programId = await reportProgramId(ctx);
    if (!programId) return;
    if (!(await questionnaireInProgram(ctx, qId, programId))) return;

    const where: Record<string, unknown> = { questionnaire: qId };
    if (from || to) {
      const d: Record<string, string> = {};
      if (from) d.$gte = from;
      if (to) d.$lte = to;
      where.date = d;
    }
    if (dId) where.department = dId;

    const sessions = await strapi.db.query("api::tracer-session.tracer-session").findMany({
      where,
      populate: { department: true },
      orderBy: { date: "asc" },
      limit: 1000000,
    });

    if (sessions.length === 0) {
      ctx.body = { data: { months: [], criteria: [], rows: [], departments: [], employees: [] } };
      return;
    }

    // диапазон месяцев
    const dates = sessions.map((s) => String(s.date ?? "").slice(0, 10)).filter(Boolean);
    const months = monthsBetween(from || dates[0], to || dates[dates.length - 1]);

    // метаданные критериев (снимки сессий → relation опросника)
    const critMeta = new Map<number, { text: string; kind: string; order: number; invert: boolean }>();
    for (const s of sessions) {
      for (const c of (s.criteriaSnapshot ?? []) as {
        id: number;
        text: string;
        kind?: string;
        order?: number;
        invert?: boolean;
      }[]) {
        if (c?.id != null && !critMeta.has(c.id)) {
          critMeta.set(c.id, { text: c.text, kind: c.kind ?? "scored", order: c.order ?? 0, invert: !!c.invert });
        }
      }
    }
    try {
      const qFull = await strapi.db
        .query("api::questionnaire.questionnaire")
        .findOne({ where: { id: qId }, populate: { criteria: true } });
      for (const c of qFull?.criteria ?? []) {
        if (!critMeta.has(c.id)) {
          critMeta.set(c.id, { text: c.text, kind: c.kind ?? "scored", order: c.order ?? 0, invert: !!c.invert });
        }
      }
    } catch {
      /* relation может отсутствовать — игнорируем */
    }
    const scored = [...critMeta.entries()]
      .filter(([, m]) => m.kind !== "input")
      .map(([id, m]) => ({ id, text: m.text, order: m.order, invert: m.invert }))
      .sort((a, b) => a.order - b.order);

    // субъекты по сессиям периода
    const sessionIds = sessions.map((s) => s.id);
    const subjects = await strapi.db.query("api::tracer-subject.tracer-subject").findMany({
      where: { session: { id: { $in: sessionIds } } },
      populate: { session: { populate: { department: true } }, employee: true },
      limit: 1000000,
    });

    const sessMonth = new Map<number, string>();
    for (const s of sessions) sessMonth.set(s.id, String(s.date ?? "").slice(0, 7));

    const norm = (v: string, invert: boolean) =>
      invert ? (v === "full" ? "none" : v === "none" ? "full" : v) : v;
    type Cnt = { full: number; partial: number; none: number; na: number };
    const emptyCnt = (): Cnt => ({ full: 0, partial: 0, none: 0, na: 0 });
    const compliance = (o: Cnt): number | null => {
      const a = o.full + o.partial + o.none;
      return a ? Math.round(((o.full + o.partial * 0.5) / a) * 1000) / 10 : null;
    };

    // критерий → месяц → счётчики; отдел → месяц → % сотрудников; сотрудник → месяц → %
    const cm = new Map<number, Map<string, Cnt>>();
    const dm = new Map<string, { id?: number; name: string; scores: Map<string, number[]>; sessions: Map<string, Set<number>> }>();
    const em = new Map<number, { name: string; position: string; scores: Map<string, number[]> }>();

    for (const sub of subjects) {
      const sid = sub.session?.id;
      const month = sid ? sessMonth.get(sid) : undefined;
      if (!month) continue;
      const ans = (sub.answers || {}) as Record<string, string>;
      for (const c of scored) {
        const raw = ans[c.id] ?? ans[String(c.id)];
        if (raw === undefined || raw === null) continue;
        const v = norm(raw, c.invert);
        if (!cm.has(c.id)) cm.set(c.id, new Map());
        const mm = cm.get(c.id)!;
        if (!mm.has(month)) mm.set(month, emptyCnt());
        const o = mm.get(month)!;
        if (o[v as keyof Cnt] !== undefined) o[v as keyof Cnt]++;
      }
      const dName = sub.session?.department?.name ?? sub.departmentSnapshot ?? "—";
      const dId = sub.session?.department?.id;
      const dKey = dId ? `id:${dId}` : `snapshot:${dName}`;
      if (!dm.has(dKey)) dm.set(dKey, { id: dId, name: dName, scores: new Map(), sessions: new Map() });
      const de = dm.get(dKey)!;
      const score = sub.scorePercent == null ? null : Number(sub.scorePercent);
      if (score != null && Number.isFinite(score)) {
        if (!de.scores.has(month)) de.scores.set(month, []);
        de.scores.get(month)!.push(score);
      }
      if (!de.sessions.has(month)) de.sessions.set(month, new Set());
      de.sessions.get(month)!.add(sid);

      const empId = sub.employee?.id;
      if (empId) {
        if (!em.has(empId))
          em.set(empId, {
            name: sub.employee?.fullName ?? sub.label ?? "—",
            position: sub.employee?.position ?? sub.positionSnapshot ?? "",
            scores: new Map(),
          });
        const ee = em.get(empId)!;
        if (score != null && Number.isFinite(score)) {
          if (!ee.scores.has(month)) ee.scores.set(month, []);
          ee.scores.get(month)!.push(score);
        }
      }
    }

    const rows = scored.map((c) => {
      const mm = cm.get(c.id) ?? new Map<string, Cnt>();
      const cells = months.map((month) => {
        const o = mm.get(month) ?? emptyCnt();
        return {
          month,
          compliancePct: compliance(o),
          full: o.full,
          partial: o.partial,
          none: o.none,
          na: o.na,
          total: o.full + o.partial + o.none + o.na,
        };
      });
      const pts = cells.filter((x) => x.compliancePct != null).map((x) => x.compliancePct as number);
      return {
        critId: c.id,
        text: c.text,
        order: c.order,
        cells,
        trend: classifyTrend(pts),
        firstPct: pts[0] ?? null,
        lastPct: pts.length ? pts[pts.length - 1] : null,
      };
    });

    const departments = [...dm.values()]
      .map((e) => {
        const cells = months.map((month) => {
          const arr = e.scores.get(month) ?? [];
          const avgP = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
          return { month, avgPercent: avgP, sessions: e.sessions.get(month)?.size ?? 0 };
        });
        const pts = cells.filter((x) => x.avgPercent != null).map((x) => x.avgPercent as number);
        return {
          departmentId: e.id,
          name: e.name,
          cells,
          trend: classifyTrend(pts),
          firstPct: pts[0] ?? null,
          lastPct: pts.length ? pts[pts.length - 1] : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // по сотрудникам: средний % за месяц (худшие — сверху)
    const employees = [...em.entries()]
      .map(([id, e]) => {
        const cells = months.map((month) => {
          const arr = e.scores.get(month) ?? [];
          const avgP = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
          return { month, avgPercent: avgP, sessions: arr.length };
        });
        const pts = cells.filter((x) => x.avgPercent != null).map((x) => x.avgPercent as number);
        return {
          employeeId: id,
          name: e.name,
          position: e.position,
          cells,
          trend: classifyTrend(pts),
          firstPct: pts[0] ?? null,
          lastPct: pts.length ? pts[pts.length - 1] : null,
        };
      })
      .sort((a, b) => (a.lastPct ?? 999) - (b.lastPct ?? 999));

    ctx.body = {
      data: {
        months,
        criteria: scored.map((c) => ({ id: c.id, text: c.text, order: c.order })),
        rows,
        departments,
        employees,
      },
    };
  },
};
