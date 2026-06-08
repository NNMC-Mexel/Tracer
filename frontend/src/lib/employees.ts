import { strapiFetch } from "./strapi";

export interface Organization {
  id: number;
  documentId: string;
  name: string;
  code?: string;
}

export interface Department {
  id: number;
  documentId: string;
  name: string;
  organization?: Organization;
}

export interface Employee {
  id: number;
  documentId: string;
  fullName: string;
  position?: string;
  category?: string;
  active: boolean;
  department?: Department | null;
  organization?: Organization | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { pagination: { page: number; pageSize: number; total: number; pageCount: number } };
}

interface ListEmployeesParams {
  search?: string;
  organizationId?: number;
  departmentId?: number;
  page?: number;
  pageSize?: number;
}

/** Список сотрудников с поиском по ФИО и фильтрами по организации/подразделению. */
export async function listEmployees(
  params: ListEmployeesParams = {},
): Promise<Paginated<Employee>> {
  const { search, organizationId, departmentId, page = 1, pageSize = 20 } = params;
  const qs = new URLSearchParams();
  qs.set("populate[0]", "department");
  qs.set("populate[1]", "organization");
  qs.set("sort[0]", "fullName:asc");
  qs.set("pagination[page]", String(page));
  qs.set("pagination[pageSize]", String(pageSize));
  if (search && search.trim()) {
    qs.set("filters[fullName][$containsi]", search.trim());
  }
  if (organizationId) qs.set("filters[organization][id][$eq]", String(organizationId));
  if (departmentId) qs.set("filters[department][id][$eq]", String(departmentId));
  return strapiFetch<Paginated<Employee>>(`/api/employees?${qs.toString()}`);
}

/** Все организации (их немного). */
export async function listOrganizations(): Promise<Organization[]> {
  const res = await strapiFetch<Paginated<Organization>>(
    "/api/organizations?sort[0]=name:asc&pagination[pageSize]=100",
  );
  return res.data;
}

/** Подразделения, опционально по организации. */
export async function listDepartments(organizationId?: number): Promise<Department[]> {
  const qs = new URLSearchParams();
  qs.set("sort[0]", "name:asc");
  qs.set("pagination[pageSize]", "500");
  qs.set("populate[0]", "organization");
  if (organizationId) qs.set("filters[organization][id][$eq]", String(organizationId));
  const res = await strapiFetch<Paginated<Department>>(`/api/departments?${qs.toString()}`);
  return res.data;
}

export interface NewEmployeeInput {
  fullName: string;
  position?: string;
  departmentId?: number;
  organizationId?: number;
}

/** Создание нового сотрудника с фронта. */
export async function createEmployee(input: NewEmployeeInput): Promise<Employee> {
  const res = await strapiFetch<{ data: Employee }>("/api/employees", {
    method: "POST",
    body: JSON.stringify({
      data: {
        fullName: input.fullName,
        position: input.position,
        department: input.departmentId,
        organization: input.organizationId,
      },
    }),
  });
  return res.data;
}
