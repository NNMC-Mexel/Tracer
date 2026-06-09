/**
 * До-засев (идемпотентно):
 *  1) Опросник «Правила обработки рук» (если ещё нет).
 *  2) Отдел «Отдел лечебного питания» (аутсорс) под ННМЦ (если ещё нет).
 *  3) Категория ВМР/СМР/ММП/ДР каждому сотруднику по должности.
 *
 *   node scripts/seed-extras.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const HAND = {
  slug: "hand-hygiene",
  name: "Правила обработки рук медицинского персонала",
  subjectType: "employee",
  order: 0,
  criteria: [
    "Что такое МЦБП-05?",
    "Уровни обработки рук (1. С мылом и водой; 2. С применением антисептика; 3. Хирургическая)",
    "Покажите, как вы обрабатываете руки (все 6 этапов с соблюдением последовательности)",
    "Пять моментов гигиены рук (перед контактом с пациентом; перед чистой/асептической процедурой; после ситуации с риском контакта с биожидкостями; после контакта с пациентом; после контакта с объектами окружения пациента)",
    "Внешний вид рук (подстриженные ногти, отсутствие лака, искусственных ногтей, украшений и часов)",
    "Обработка рук при входе в отделение и выходе из него",
  ],
};

const OLP_DEPT = "Отдел лечебного питания";
const OLP_ORG_CODE = "ННМЦ";

/** Должность -> категория. Порядок важен (ММП до СМР из-за «сестра-хозяйка»). */
function classify(posRaw) {
  const p = (posRaw || "").toLowerCase();
  if (/санитар|уборщиц|буфетчиц|сестра-хозяйк|машинист по стирке|швея|прачеч/.test(p)) return "ММП";
  if (/врач|ординатор|резидент/.test(p)) return "ВМР";
  if (/медсестр|медбрат|фельдшер|лаборант|анестезист|акушер|массажист|инструктор лфк|перфузиолог|рентген.*сестр|сестра/.test(p)) return "СМР";
  return "ДР";
}

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const db = (uid) => app.db.query(uid);
  const Q = "api::questionnaire.questionnaire";
  const C = "api::criterion.criterion";
  const ORG = "api::organization.organization";
  const DEP = "api::department.department";
  const EMP = "api::employee.employee";
  try {
    // 1) Опросник по рукам
    const existsHand = await db(Q).findOne({ where: { slug: HAND.slug } });
    if (existsHand) {
      console.log("[extras] Опросник hand-hygiene уже есть — пропускаю.");
    } else {
      const rec = await db(Q).create({
        data: { slug: HAND.slug, name: HAND.name, subjectType: HAND.subjectType, order: HAND.order, active: true },
      });
      let i = 1;
      for (const text of HAND.criteria) {
        await db(C).create({ data: { text, order: i++, questionnaire: rec.id } });
      }
      console.log(`[extras] Создан опросник «${HAND.name}» (${HAND.criteria.length} критериев).`);
    }

    // 2) Отдел лечебного питания
    const existsDep = await db(DEP).findOne({ where: { name: OLP_DEPT } });
    if (existsDep) {
      console.log("[extras] Отдел лечебного питания уже есть — пропускаю.");
    } else {
      const org = await db(ORG).findOne({ where: { code: OLP_ORG_CODE } });
      await db(DEP).create({ data: { name: OLP_DEPT, organization: org ? org.id : null } });
      console.log(`[extras] Создан отдел «${OLP_DEPT}».`);
    }

    // 3) Категории сотрудников (по уникальным должностям -> updateMany)
    const emps = await db(EMP).findMany({ select: ["id", "position"], limit: 1000000 });
    const byPos = new Map();
    for (const e of emps) {
      const pos = e.position ?? "";
      if (!byPos.has(pos)) byPos.set(pos, classify(pos));
    }
    let updated = 0;
    const counts = { ВМР: 0, СМР: 0, ММП: 0, ДР: 0 };
    for (const [position, category] of byPos) {
      const res = await db(EMP).updateMany({ where: { position }, data: { category } });
      const n = res?.count ?? 0;
      updated += n;
      counts[category] += n;
    }
    console.log(`[extras] Категории проставлены: обновлено ${updated}. ВМР=${counts.ВМР} СМР=${counts.СМР} ММП=${counts.ММП} ДР=${counts.ДР}`);
    console.log("[extras] Готово.");
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[extras] ОШИБКА:", e); process.exit(1); });
