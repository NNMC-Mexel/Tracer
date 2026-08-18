"use strict";

/**
 * Переименовывает отделы без потери связей с сотрудниками и проверками.
 * Миграция идемпотентна по данным и выполняется Strapi в транзакции один раз.
 */

const RENAME_RULES = [
  {
    to: "АКЦ",
    from: ["Амбулаторно-консультативный центр"],
  },
  {
    to: "Аптека ННМЦ",
    from: ["Аптека №1"],
  },
  {
    to: "Аптека ДКХЦ",
    from: ["Аптека №2"],
  },
  {
    to: "ОАРИТ №1",
    from: [
      "Отдел анестезиологии,реанимации и интенсивной терапии №1",
      "Отдел анестезиологии,реанимации и интенсивной терапии (ОАРИТ №1)",
    ],
  },
  {
    to: "ОАРИТ №2",
    from: [
      "Отдел анестезиологии,реанимации и интенсивной терапии №2",
      "Отдел анестезиологии,реанимации и интенсивной терапии (ОАРИТ №2)",
      "Отдел анестезиологии,реанимации и интенсивной терапии кардиологического и кардиохирургического профиля (ОАРИТ №2)",
    ],
  },
];

function normalizeDepartmentName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .replace(/№\s+/g, "№");
}

async function findTargetInSameOrganization(knex, source, targetName, hasOrganizationLinks) {
  const candidates = await knex("departments")
    .select("id")
    .where({ name: targetName })
    .whereNot({ id: source.id });

  if (!hasOrganizationLinks) return candidates[0];

  const sourceOrganizations = await knex("departments_organization_lnk")
    .where({ department_id: source.id })
    .pluck("organization_id");

  for (const candidate of candidates) {
    const targetOrganizations = await knex("departments_organization_lnk")
      .where({ department_id: candidate.id })
      .pluck("organization_id");
    if (
      sourceOrganizations.length === targetOrganizations.length
      && sourceOrganizations.every((id) => targetOrganizations.includes(id))
    ) {
      return candidate;
    }
  }

  return undefined;
}

async function moveDepartmentLinks(knex, table, ownerColumn, sourceId, targetId) {
  if (!(await knex.schema.hasTable(table))) return;

  const alreadyLinked = await knex(table)
    .where({ department_id: targetId })
    .pluck(ownerColumn);
  if (alreadyLinked.length > 0) {
    await knex(table)
      .where({ department_id: sourceId })
      .whereIn(ownerColumn, alreadyLinked)
      .del();
  }
  await knex(table)
    .where({ department_id: sourceId })
    .update({ department_id: targetId });
}

async function mergeDepartment(knex, sourceId, targetId, hasOrganizationLinks) {
  await moveDepartmentLinks(knex, "employees_department_lnk", "employee_id", sourceId, targetId);
  await moveDepartmentLinks(knex, "tracer_sessions_department_lnk", "tracer_session_id", sourceId, targetId);
  if (hasOrganizationLinks) {
    await knex("departments_organization_lnk").where({ department_id: sourceId }).del();
  }
  await knex("departments").where({ id: sourceId }).del();
}

module.exports = {
  async up(knex) {
    if (!(await knex.schema.hasTable("departments"))) return;

    const hasOrganizationLinks = await knex.schema.hasTable("departments_organization_lnk");
    const departments = await knex("departments").select("id", "name");

    for (const rule of RENAME_RULES) {
      const oldNames = new Set(rule.from.map(normalizeDepartmentName));
      const sources = departments.filter(
        (department) => oldNames.has(normalizeDepartmentName(department.name)),
      );

      for (const source of sources) {
        const target = await findTargetInSameOrganization(
          knex,
          source,
          rule.to,
          hasOrganizationLinks,
        );
        if (target) {
          await mergeDepartment(knex, source.id, target.id, hasOrganizationLinks);
        } else {
          await knex("departments")
            .where({ id: source.id })
            .update({ name: rule.to, updated_at: new Date() });
        }
      }
    }

    if (await knex.schema.hasTable("tracer_subjects")) {
      const snapshots = await knex("tracer_subjects")
        .distinct("department_snapshot")
        .whereNotNull("department_snapshot");
      for (const snapshot of snapshots) {
        const normalized = normalizeDepartmentName(snapshot.department_snapshot);
        const rule = RENAME_RULES.find((item) =>
          item.from.some((oldName) => normalizeDepartmentName(oldName) === normalized),
        );
        if (rule) {
          await knex("tracer_subjects")
            .where({ department_snapshot: snapshot.department_snapshot })
            .update({ department_snapshot: rule.to, updated_at: new Date() });
        }
      }
    }
  },
};
