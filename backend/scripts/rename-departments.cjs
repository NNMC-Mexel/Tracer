/**
 * Переименование отделов без потери связей и истории.
 *   node scripts/rename-departments.cjs          — предварительный просмотр
 *   node scripts/rename-departments.cjs --apply  — применить
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const RENAMES = {
  "Амбулаторно-консультативный центр": "АКЦ",
  "Аптека №1": "Аптека ННМЦ",
  "Аптека №2": "Аптека ДКХЦ",
  "Отдел анестезиологии,реанимации и интенсивной терапии (ОАРИТ №1)": "ОАРИТ №1",
  "Отдел анестезиологии,реанимации и интенсивной терапии кардиологического и кардиохирургического профиля (ОАРИТ №2)": "ОАРИТ №2",
};

async function main() {
  const apply = process.argv.includes("--apply");
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const q = (uid) => app.db.query(uid);
  const DEP = "api::department.department";
  const EMP = "api::employee.employee";
  const SESSION = "api::tracer-session.tracer-session";
  const SUBJECT = "api::tracer-subject.tracer-subject";

  try {
    const departments = await q(DEP).findMany({ populate: { organization: true }, limit: -1 });
    let found = 0;
    let renamed = 0;
    let merged = 0;

    for (const [oldName, newName] of Object.entries(RENAMES)) {
      const sources = departments.filter((department) => department.name === oldName);
      for (const source of sources) {
        found++;
        const organizationId = source.organization?.id;
        const target = departments.find(
          (department) => department.id !== source.id && department.name === newName && department.organization?.id === organizationId,
        );
        console.log(
          `[departments] ${apply ? "APPLY" : "DRY"}: ${oldName} -> ${newName}` +
          ` (org=${source.organization?.name ?? "—"}, id=${source.id}${target ? `, merge into id=${target.id}` : ""})`,
        );
        if (!apply) continue;

        if (target) {
          await q(EMP).updateMany({ where: { department: source.id }, data: { department: target.id } });
          await q(SESSION).updateMany({ where: { department: source.id }, data: { department: target.id } });
          await q(DEP).delete({ where: { id: source.id } });
          merged++;
        } else {
          await q(DEP).update({ where: { id: source.id }, data: { name: newName } });
          renamed++;
        }
      }

      if (apply) {
        await q(SUBJECT).updateMany({ where: { departmentSnapshot: oldName }, data: { departmentSnapshot: newName } });
      }
    }

    console.log(`[departments] Найдено: ${found}; переименовано: ${renamed}; объединено: ${merged}; режим: ${apply ? "APPLY" : "DRY-RUN"}`);
  } finally {
    await app.destroy();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("[departments] ОШИБКА:", error);
  process.exit(1);
});
