/**
 * Сидинг направлений (Program) и опросников отдела качества.
 *  1. создаёт направления «Эпидемиология» и «Отдел качества» (если нет);
 *  2. все существующие опросники не-качества → «Эпидемиология», scale=three_level;
 *  3. ПЕРЕСОЗДАЁТ опросники отдела качества (10 шт) с актуальной структурой.
 *
 * Критерий: строка = оценочный (Да/Нет, в %); { t, input:true } = поле-вписка (в % не входит).
 *
 *   node scripts/seed-programs.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const PROGRAMS = [
  { slug: "epidemiology", name: "Отдел инфекционного контроля" },
  { slug: "quality", name: "Отдел качества" },
];

// scale у всех качества — binary (Да/Нет). input-критерии не входят в %.
const QUALITY = [
  {
    slug: "ipsg05-hands",
    name: "IPSG-05 Обработка рук (знания персонала)",
    subjectType: "employee",
    order: 20,
    criteria: [
      "Что такое МЦБП-05?",
      "Уровни обработки рук (1. с мылом и водой; 2. с применением антисептика; 3. хирургическая)",
      "Покажите, как вы обрабатываете руки (все 6 этапов с соблюдением последовательности)",
      "Пять моментов гигиены рук",
      "Внешний вид рук (подстриженные ногти, без лака, искусственных ногтей, украшений и часов)",
      "Обработка рук при входе в отделение и выходе из него",
    ],
  },
  {
    slug: "ipsg01-patient-id",
    name: "IPSG-01 Идентификация пациента",
    subjectType: "employee",
    order: 21,
    criteria: [
      { t: "Браслеты: из ___ проверенных пациентов носят браслет ___ (кол-во)", input: true },
      { t: "Опрос пациентов: из ___ опрошенных знают, зачем носят браслет ___ (кол-во)", input: true },
      "Что такое МЦБП-01?",
      "На основании каких данных идентифицируется пациент перед выдачей ЛС? (ФИО полностью; число, месяц, год рождения)",
      "Идентификация выполняется путём: устный опрос ФИО и даты рождения; сверка с браслетом; сверка с мед. документацией",
      "Перед чем идентифицируют пациента (лечение, процедуры, диагностика и любые вмешательства)",
    ],
  },
  {
    slug: "ipsg02-spor",
    name: "IPSG-02 Передача пациентов по схеме СПОР",
    subjectType: "employee",
    order: 22,
    criteria: [
      { t: "Из ___ проверенных историй полное соблюдение передачи по схеме СПОР ___ (кол-во)", input: true },
      "В каких случаях заводят форму СПОР? (перевод из отдела в отдел; на манипуляции/операции; лечение в других отделах; на обследования; перевод в другие МО)",
      "Между кем происходит передача пациентов внутри больницы?",
    ],
  },
  {
    slug: "ipsg02-verbal",
    name: "IPSG-02 Передача информации устно и по телефону",
    subjectType: "employee",
    order: 23,
    criteria: [
      "Тактика при получении устной информации/назначения: знает правило «Записать → Прочитать вслух → Услышать подтверждение». В «Листок передачи устного/телефонного сообщения» записывает: ФИО передавшего; ФИО принявшего; время и дату получения; текст сообщения критического значения (если медикаментозное назначение — ФИО и дату рождения пациента, название ЛС, дозу, частоту/кратность, способ введения)",
      "Знает порядок ведения документа: бланк своевременно подшивается в медицинскую карту и подписывается врачом в течение 24 часов",
      { t: "Лист передачи устного/телефонного сообщения на посту (Есть/Нет)", input: true },
      { t: "Журнал передачи критических значений и форма устного сообщения в истории болезни (Есть/Нет)", input: true },
    ],
  },
  {
    slug: "ipsg03-concentrated-electrolytes",
    name: "IPSG-03 Концентрированные электролиты (хранение)",
    subjectType: "department",
    order: 24,
    criteria: [
      "Наличие гигрометра в комнате для хранения лекарственных средств и ИМН",
      "Наличие журнала регистрации температуры и влажности комнаты с ежедневными записями",
      "Наличие стикера «Концентрированные электролиты» на флаконах и ампулах (если упаковка вскрыта)",
      "Наличие надписи срока годности на упаковке",
      "Наличие инструкции к применению на флаконах и ампулах",
      "Наличие утверждённого списка медикаментов с высокой степенью риска",
      "Концентрированные электролиты, хранящиеся при комнатной температуре, находятся в шкафу, закрывающемся на ключ",
      { t: "Сроки годности (50%): из ___ проверенных истёк срок у ___; название ___", input: true },
    ],
  },
  {
    slug: "ipsg03-lasa",
    name: "IPSG-03 Медикаменты схожие по виду и названию",
    subjectType: "department",
    order: 25,
    criteria: [
      "Лекарственные средства со схожими названиями или упаковками хранятся отдельно, на разных полках",
      "Наличие надписи срока годности на упаковке лекарственных средств",
      "Наличие инструкции к применению внутри упаковки лекарственных средств",
      "Соблюдение условий хранения лекарственных средств",
      "Препарат, схожий по названию, обозначен знаком голубого цвета «СТОП! Медикаменты схожие по названию»",
      "Препарат, схожий по внешнему виду, обозначен знаком жёлтого цвета «СТОП! Медикаменты схожие по внешнему виду»",
      { t: "Сроки годности (50%): из ___ проверенных ЛС истёк срок у ___; название ___", input: true },
    ],
  },
  {
    slug: "ipsg03-high-alert",
    name: "IPSG-03 Медикаменты высокого риска (МВР)",
    subjectType: "department",
    order: 26,
    criteria: [
      "Наличие стикера «Красный стоп» на упаковках и ампулах МВР (если упаковка вскрыта)",
      "Наличие надписи срока годности на упаковке МВР",
      "Наличие инструкции к применению внутри упаковки МВР",
      "Наличие утверждённого списка медикаментов с высокой степенью риска",
      "Соблюдение сроков годности лекарственных средств",
      "Соблюдение условий хранения лекарственных средств",
      "МВР, хранящиеся при комнатной температуре, находятся в шкафу, закрывающемся на ключ",
      { t: "Сроки годности (50%): из ___ проверенных МВР истёк срок у ___; название ___", input: true },
    ],
  },
  {
    slug: "ipsg06-fall-risk",
    name: "IPSG-06 Профилактика падений (знания персонала)",
    subjectType: "employee",
    order: 27,
    criteria: [
      { t: "Наличие соответствующих знаков на дверях палаты (Есть/Нет)", input: true },
      "Что такое МЦБП-06?",
      "Согласно какой шкале оценивается риск падения и когда? (взрослые — Морзе при поступлении; дети — Хамти-Дамти)",
      "Ваши действия при определении высокого риска падения?",
      "Критерии переоценки риска падения?",
    ],
  },
  {
    slug: "ipsg04-site-marking",
    name: "IPSG-04 Маркировка операционного участка",
    subjectType: "department",
    order: 28,
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
    globalSubjects: true,
    order: 29,
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
      } else if (rec.name !== p.name) {
        await app.db.query(PROG).update({ where: { id: rec.id }, data: { name: p.name } });
        console.log(`[prog] Переименовано «${rec.name}» → «${p.name}»`);
      }
      progId[p.slug] = rec.id;
    }

    const qualitySlugs = new Set(QUALITY.map((q) => q.slug));

    // 2. не-качества → эпидемиология + scale three_level
    const all = await app.db.query(Q).findMany();
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

    // (опц.) привязать всех пользователей без направления к «Эпидемиология»
    if (process.env.ASSIGN_ALL_EPID === "1") {
      const U = "plugin::users-permissions.user";
      const users = await app.db.query(U).findMany({ populate: { program: true } });
      let n = 0;
      for (const u of users) {
        if (!u.program) {
          await app.db.query(U).update({ where: { id: u.id }, data: { program: progId.epidemiology } });
          n++;
        }
      }
      console.log(`[prog] Пользователей привязано к «Эпидемиология»: ${n}`);
    }

    // 3. пересоздаём опросники качества
    for (const slug of qualitySlugs) {
      const ex = await app.db.query(Q).findOne({ where: { slug } });
      if (ex) {
        await app.db.query(C).deleteMany({ where: { questionnaire: ex.id } });
        await app.db.query(Q).delete({ where: { id: ex.id } });
      }
    }
    for (const q of QUALITY) {
      const rec = await app.db.query(Q).create({
        data: {
          slug: q.slug,
          name: q.name,
          subjectType: q.subjectType,
          scale: "binary",
          allowNa: false,
          globalSubjects: !!q.globalSubjects,
          order: q.order,
          active: true,
          program: progId.quality,
        },
      });
      let i = 1;
      let scoredN = 0;
      let inputN = 0;
      for (const c of q.criteria) {
        const isObj = typeof c === "object";
        const isInput = isObj && c.input;
        const text = isObj ? c.t : c;
        const allowNa = isObj ? !!c.allowNa : false;
        await app.db.query(C).create({
          data: { text, kind: isInput ? "input" : "scored", allowNa, order: i++, questionnaire: rec.id },
        });
        if (isInput) inputN++; else scoredN++;
      }
      console.log(`[prog] Качество: «${q.name}» — оценочных ${scoredN}, ввод ${inputN}${q.globalSubjects ? ", глобальный список" : ""}`);
    }
    console.log(`[prog] Опросников качества: ${QUALITY.length}. Готово.`);
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[prog] ОШИБКА:", e); process.exit(1); });
