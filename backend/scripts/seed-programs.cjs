/**
 * Сидинг направлений (Program) и опросников отдела качества.
 * Идемпотентно:
 *  1. создаёт направления «Эпидемиология» и «Отдел качества» (если нет);
 *  2. все существующие опросники без направления → «Эпидемиология», scale=three_level;
 *  3. создаёт 6 опросников отдела качества (если их ещё нет) с нужной шкалой.
 *
 *   node scripts/seed-programs.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const PROGRAMS = [
  { slug: "epidemiology", name: "Эпидемиология" },
  { slug: "quality", name: "Отдел качества" },
];

// Опросники отдела качества. scale: "binary" (Да/Нет). allowNa — только где есть «Неприменим».
const QUALITY = [
  {
    slug: "ipsg03-concentrated-electrolytes",
    name: "IPSG-03 Концентрированные электролиты (хранение)",
    subjectType: "department",
    scale: "binary",
    allowNa: false,
    order: 10,
    criteria: [
      "Наличие гигрометра в комнате для хранения лекарственных средств и ИМН",
      "Наличие журнала регистрации температуры и влажности комнаты с ежедневными записями",
      "Наличие стикера «Концентрированные электролиты» на флаконах и ампулах (если упаковка вскрыта)",
      "Наличие надписи срока годности на упаковке",
      "Наличие инструкции к применению на флаконах и ампулах",
      "Наличие утверждённого списка медикаментов с высокой степенью риска",
      "Концентрированные электролиты, хранящиеся при комнатной температуре, находятся в шкафу, закрывающемся на ключ",
    ],
  },
  {
    slug: "ipsg03-lasa",
    name: "IPSG-03 Медикаменты схожие по виду и названию",
    subjectType: "department",
    scale: "binary",
    allowNa: false,
    order: 11,
    criteria: [
      "Лекарственные средства со схожими названиями или упаковками хранятся отдельно друг от друга, на разных полках",
      "Наличие надписи срока годности на упаковке лекарственных средств",
      "Наличие инструкции к применению внутри упаковки лекарственных средств",
      "Соблюдение условий хранения лекарственных средств",
      "Препарат, схожий по названию, обозначен знаком голубого цвета «СТОП! Медикаменты схожие по названию»",
      "Препарат, схожий по внешнему виду, обозначен знаком жёлтого цвета «СТОП! Медикаменты схожие по внешнему виду»",
    ],
  },
  {
    slug: "ipsg03-high-alert",
    name: "IPSG-03 Медикаменты высокого риска (МВР)",
    subjectType: "department",
    scale: "binary",
    allowNa: false,
    order: 12,
    criteria: [
      "Наличие стикера «Красный стоп» на упаковках и ампулах МВР (если упаковка вскрыта)",
      "Наличие надписи срока годности на упаковке МВР",
      "Наличие инструкции к применению внутри упаковки МВР",
      "Наличие утверждённого списка медикаментов с высокой степенью риска",
      "Соблюдение сроков годности лекарственных средств",
      "Соблюдение условий хранения лекарственных средств",
      "МВР, хранящиеся при комнатной температуре, находятся в шкафу, закрывающемся на ключ",
    ],
  },
  {
    slug: "ipsg06-fall-risk",
    name: "IPSG-06 Профилактика падений (знания персонала)",
    subjectType: "employee",
    scale: "binary",
    allowNa: false,
    order: 13,
    criteria: [
      "Что такое МЦБП-06?",
      "Согласно какой шкале оценивается риск падения и когда? (взрослые — шкала Морзе при поступлении; дети — Хамти-Дамти)",
      "Ваши действия при определении высокого риска падения?",
      "Критерии переоценки риска падения?",
    ],
  },
  {
    slug: "ipsg04-site-marking",
    name: "IPSG-04 Маркировка операционного участка",
    subjectType: "department",
    scale: "binary",
    allowNa: true,
    order: 14,
    criteria: [
      "Наличие маркировки операционного участка",
      "Наличие информированного согласия пациента",
      "Наличие согласия на переливание компонентов крови",
      "Правильное расположение документов МКСБ",
    ],
  },
  {
    slug: "ipsg04-timeout",
    name: "IPSG-04 Полное заполнение формы тайм-аута",
    subjectType: "department",
    scale: "binary",
    allowNa: false,
    order: 15,
    criteria: [
      "Проводился ли тайм-аут до начала анестезии и до рассечения кожи; заполнена ли форма Тайм-аут? (проверка формы)",
      "Имелись ли проблемы с оборудованием, требующие устранения?",
      "Проведён ли подсчёт мягкого инвентаря и игл?",
      "Проводился ли тайм-аут до того, как пациент покинет операционную; заполнена ли форма Тайм-аут? (проверка формы)",
    ],
  },
];

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const PROG = "api::program.program";
  const Q = "api::questionnaire.questionnaire";
  const C = "api::criterion.criterion";
  try {
    // 1. направления
    const progId = {};
    for (const p of PROGRAMS) {
      let rec = await app.db.query(PROG).findOne({ where: { slug: p.slug } });
      if (!rec) {
        rec = await app.db.query(PROG).create({ data: { name: p.name, slug: p.slug } });
        console.log(`[prog] Создано направление «${p.name}»`);
      }
      progId[p.slug] = rec.id;
    }

    const qualitySlugs = new Set(QUALITY.map((q) => q.slug));

    // 2. существующие опросники (не качества) → эпидемиология + scale three_level
    const all = await app.db.query(Q).findMany({ populate: { program: true } });
    let assigned = 0;
    for (const q of all) {
      if (qualitySlugs.has(q.slug)) continue;
      const data = {};
      if (!q.program) data.program = progId.epidemiology;
      if (!q.scale) data.scale = "three_level";
      if (Object.keys(data).length) {
        await app.db.query(Q).update({ where: { id: q.id }, data });
        assigned++;
      }
    }
    console.log(`[prog] Опросников привязано к «Эпидемиология»: ${assigned}`);

    // 3. опросники отдела качества
    let created = 0;
    for (const q of QUALITY) {
      const exists = await app.db.query(Q).findOne({ where: { slug: q.slug } });
      if (exists) continue;
      const rec = await app.db.query(Q).create({
        data: {
          slug: q.slug,
          name: q.name,
          subjectType: q.subjectType,
          scale: q.scale,
          allowNa: q.allowNa,
          order: q.order,
          active: true,
          program: progId.quality,
        },
      });
      let i = 1;
      for (const text of q.criteria) {
        await app.db.query(C).create({ data: { text, order: i++, questionnaire: rec.id } });
      }
      created++;
      console.log(`[prog] Качество: «${q.name}» (${q.subjectType}, ${q.scale}${q.allowNa ? ", Н/П" : ""}) — критериев ${q.criteria.length}`);
    }
    console.log(`[prog] Создано опросников качества: ${created}`);
    console.log("[prog] Готово.");
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[prog] ОШИБКА:", e); process.exit(1); });
