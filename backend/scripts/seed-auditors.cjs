/**
 * Тестовые аудиторы по направлениям (локально):
 *   auditor1 -> Эпидемиология
 *   auditor2 -> Отдел качества (создаётся с паролем, если нет)
 * Требует, чтобы направления уже были созданы (seed-programs.cjs).
 *
 *   node scripts/seed-auditors.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");
const bcrypt = require("bcryptjs");

const AUDITOR2 = {
  username: "auditor2",
  email: "auditor2@nnmc.local",
  password: "Quality123!",
};

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const PROG = "api::program.program";
  const U = "plugin::users-permissions.user";
  const R = "plugin::users-permissions.role";
  try {
    const epid = await app.db.query(PROG).findOne({ where: { slug: "epidemiology" } });
    const quality = await app.db.query(PROG).findOne({ where: { slug: "quality" } });
    if (!epid || !quality) {
      console.error("[aud] Нет направлений. Сначала запустите seed-programs.cjs");
      return;
    }
    const authRole = await app.db.query(R).findOne({ where: { type: "authenticated" } });

    // auditor1 -> Эпидемиология
    const a1 = await app.db.query(U).findOne({ where: { username: "auditor1" } });
    if (a1) {
      await app.db.query(U).update({ where: { id: a1.id }, data: { program: epid.id } });
      console.log("[aud] auditor1 -> Эпидемиология");
    } else {
      console.log("[aud] auditor1 не найден (пропуск)");
    }

    // auditor2 -> Отдел качества
    const a2 = await app.db.query(U).findOne({ where: { username: AUDITOR2.username } });
    if (!a2) {
      const hash = await bcrypt.hash(AUDITOR2.password, 10);
      await app.db.query(U).create({
        data: {
          username: AUDITOR2.username,
          email: AUDITOR2.email,
          password: hash,
          confirmed: true,
          blocked: false,
          provider: "local",
          role: authRole.id,
          program: quality.id,
        },
      });
      console.log(`[aud] auditor2 создан (пароль ${AUDITOR2.password}) -> Отдел качества`);
    } else {
      await app.db.query(U).update({
        where: { id: a2.id },
        data: { program: quality.id, confirmed: true, role: authRole.id },
      });
      console.log("[aud] auditor2 уже есть -> Отдел качества");
    }
    console.log("[aud] Готово.");
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[aud] ОШИБКА:", e); process.exit(1); });
