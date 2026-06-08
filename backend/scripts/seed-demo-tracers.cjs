/**
 * Демо-данные трейсеров за несколько месяцев — чтобы посмотреть отчёты.
 *   node scripts/seed-demo-tracers.cjs          — добавить, если трейсеров ещё нет
 *   node scripts/seed-demo-tracers.cjs --reset   — очистить все трейсеры и создать заново
 * Удалить демо позже: node scripts/delete-test-tracers.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const WEIGHT = { full: 1, partial: 0.5, none: 0 };
const r1 = (n) => Math.round(n * 10) / 10;
const level = (p) => (p >= 85 ? "high" : p >= 60 ? "medium" : "low");
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function randAnswer() {
  const x = Math.random();
  return x < 0.7 ? "full" : x < 0.88 ? "partial" : "none";
}

async function main() {
  const reset = process.argv.includes("--reset");
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const q = (uid) => app.db.query(uid);
  try {
    const existing = await q("api::tracer-session.tracer-session").count();
    if (existing > 0 && !reset) {
      console.log(`[demo] Уже есть ${existing} трейсеров. --reset для пересоздания.`);
      return;
    }
    if (reset) {
      await q("api::tracer-subject.tracer-subject").deleteMany({ where: {} });
      await q("api::tracer-session.tracer-session").deleteMany({ where: {} });
    }

    const questionnaires = await q("api::questionnaire.questionnaire").findMany({
      populate: { criteria: true },
      limit: -1,
    });
    // отделы с сотрудниками — берём первые 6 «крупных»
    const depts = await q("api::department.department").findMany({
      populate: { organization: true },
      limit: -1,
    });
    const chosen = [];
    for (const d of depts) {
      const emps = await q("api::employee.employee").findMany({
        where: { department: d.id, active: true },
        limit: 8,
      });
      if (emps.length >= 4) chosen.push({ dept: d, emps });
      if (chosen.length >= 6) break;
    }

    // месяцы: последние 5 (вкл. текущий)
    const now = new Date();
    const months = [];
    for (let i = 4; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(dt);
    }

    let created = 0;
    for (const { dept, emps } of chosen) {
      for (const m of months) {
        // 1–2 трейсера в месяц на отдел
        const howMany = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let k = 0; k < howMany; k++) {
          const ques = pick(questionnaires);
          const criteria = (ques.criteria ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const cCount = criteria.length;
          const day = 5 + Math.floor(Math.random() * 20);
          const date = new Date(m.getFullYear(), m.getMonth(), day).toISOString().slice(0, 10);
          const snapshot = criteria.map((c) => ({ id: c.id, text: c.text, order: c.order }));

          let subjectInputs;
          if (ques.subjectType === "employee") {
            const n = 2 + Math.floor(Math.random() * Math.min(4, emps.length - 1));
            subjectInputs = emps.slice(0, n).map((e) => {
              const answers = {};
              criteria.forEach((c) => (answers[c.id] = randAnswer()));
              return { employee: e, answers };
            });
          } else {
            const answers = {};
            criteria.forEach((c) => (answers[c.id] = randAnswer()));
            subjectInputs = [{ employee: null, answers }];
          }

          const computed = subjectInputs.map((s) => {
            let sum = 0;
            criteria.forEach((c) => (sum += WEIGHT[s.answers[c.id]] ?? 0));
            return { ...s, pct: cCount ? r1((sum / cCount) * 100) : 0 };
          });
          const sessionPct = r1(computed.reduce((a, c) => a + c.pct, 0) / computed.length);

          const session = await q("api::tracer-session.tracer-session").create({
            data: {
              questionnaire: ques.id,
              organization: dept.organization?.id ?? null,
              department: dept.id,
              date,
              time: "10:00",
              auditorName: "Демо-аудитор",
              criteriaSnapshot: snapshot,
              participants: [],
              scorePercent: sessionPct,
              complianceLevel: level(sessionPct),
            },
          });
          for (const c of computed) {
            await q("api::tracer-subject.tracer-subject").create({
              data: {
                session: session.id,
                employee: c.employee?.id ?? null,
                label: c.employee?.fullName ?? dept.name,
                positionSnapshot: c.employee?.position ?? null,
                departmentSnapshot: dept.name,
                answers: c.answers,
                notes: {},
                scorePercent: c.pct,
              },
            });
          }
          created++;
        }
      }
    }
    console.log(`[demo] Создано трейсеров: ${created} (отделов: ${chosen.length}, месяцев: ${months.length})`);
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[demo] ОШИБКА:", e); process.exit(1); });
