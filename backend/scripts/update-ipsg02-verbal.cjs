/**
 * Пересоздаёт критерии опросника IPSG-02 «Передача информации устно и по телефону»
 * (ipsg02-verbal): 2 оценочных вопроса + 2 поля-вписки. Сам опросник не трогается.
 *   node scripts/update-ipsg02-verbal.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const CRITERIA = [
  "Тактика при получении устной информации/назначения: знает правило «Записать → Прочитать вслух → Услышать подтверждение». В «Листок передачи устного/телефонного сообщения» записывает: ФИО передавшего; ФИО принявшего; время и дату получения; текст сообщения критического значения (если медикаментозное назначение — ФИО и дату рождения пациента, название ЛС, дозу, частоту/кратность, способ введения)",
  "Знает порядок ведения документа: бланк своевременно подшивается в медицинскую карту и подписывается врачом в течение 24 часов",
  { t: "Лист передачи устного/телефонного сообщения на посту (Есть/Нет)", input: true },
  { t: "Журнал передачи критических значений и форма устного сообщения в истории болезни (Есть/Нет)", input: true },
];

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const Q = "api::questionnaire.questionnaire";
  const C = "api::criterion.criterion";
  try {
    const q = await app.db.query(Q).findOne({ where: { slug: "ipsg02-verbal" } });
    if (!q) {
      console.log("[v] ipsg02-verbal не найден");
      return;
    }
    await app.db.query(C).deleteMany({ where: { questionnaire: q.id } });
    let i = 1;
    let sc = 0;
    let inp = 0;
    for (const item of CRITERIA) {
      const isInput = typeof item === "object" && item.input;
      const text = isInput ? item.t : item;
      await app.db.query(C).create({
        data: { text, kind: isInput ? "input" : "scored", allowNa: false, order: i++, questionnaire: q.id },
      });
      if (isInput) inp++; else sc++;
    }
    console.log(`[v] ipsg02-verbal обновлён: оценочных ${sc}, ввод ${inp}`);
  } finally {
    await app.destroy();
  }
})().then(() => process.exit(0)).catch((e) => { console.error("[v] ОШИБКА:", e); process.exit(1); });
