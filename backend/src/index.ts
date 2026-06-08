import type { Core } from "@strapi/strapi";

/**
 * Включает указанные действия (find/findOne/create/...) для роли
 * Users & Permissions, не создавая дубликатов.
 */
async function ensurePermissions(
  strapi: Core.Strapi,
  roleType: "authenticated" | "public",
  actions: string[],
): Promise<void> {
  const role = await strapi
    .query("plugin::users-permissions.role")
    .findOne({ where: { type: roleType } });
  if (!role) return;

  for (const action of actions) {
    const existing = await strapi
      .query("plugin::users-permissions.permission")
      .findOne({ where: { action, role: role.id } });
    if (!existing) {
      await strapi
        .query("plugin::users-permissions.permission")
        .create({ data: { action, role: role.id } });
    }
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Аудитор (Authenticated) может читать справочники и добавлять сотрудников.
    await ensurePermissions(strapi, "authenticated", [
      "api::organization.organization.find",
      "api::organization.organization.findOne",
      "api::department.department.find",
      "api::department.department.findOne",
      "api::employee.employee.find",
      "api::employee.employee.findOne",
      "api::employee.employee.create",
      // Опросники — только чтение
      "api::questionnaire.questionnaire.find",
      "api::questionnaire.questionnaire.findOne",
      "api::criterion.criterion.find",
      "api::criterion.criterion.findOne",
      // Трейсеры — чтение и проведение (кастомный submit)
      "api::tracer-session.tracer-session.find",
      "api::tracer-session.tracer-session.findOne",
      "api::tracer-session.tracer-session.submit",
      "api::tracer-session.tracer-session.delete",
      "api::tracer-subject.tracer-subject.find",
      "api::tracer-subject.tracer-subject.findOne",
      // Отчёты
      "api::report.report.years",
      "api::report.report.summary",
    ]);
  },
};
