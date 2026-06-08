"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Input,
  Select,
  Button,
  Space,
  Typography,
  App,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listEmployees,
  listDepartments,
  listOrganizations,
  type Employee,
  type Department,
  type Organization,
} from "@/lib/employees";
import AddEmployeeModal from "@/components/AddEmployeeModal";

const { Title } = Typography;

export default function EmployeesPage() {
  const { message } = App.useApp();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [search, setSearch] = useState("");
  const [orgId, setOrgId] = useState<number | undefined>();
  const [depId, setDepId] = useState<number | undefined>();

  const [data, setData] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    listOrganizations().then(setOrgs).catch(() => {});
  }, []);
  useEffect(() => {
    listDepartments(orgId).then(setDepartments).catch(() => {});
  }, [orgId]);

  const load = useCallback(() => {
    setLoading(true);
    listEmployees({ search, organizationId: orgId, departmentId: depId, page, pageSize })
      .then((res) => {
        setData(res.data);
        setTotal(res.meta.pagination.total);
      })
      .catch(() => message.error("Не удалось загрузить сотрудников"))
      .finally(() => setLoading(false));
  }, [search, orgId, depId, page, pageSize, message]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const columns: ColumnsType<Employee> = useMemo(
    () => [
      { title: "ФИО", dataIndex: "fullName", key: "fullName" },
      { title: "Должность", dataIndex: "position", key: "position" },
      {
        title: "Подразделение",
        key: "department",
        render: (_, r) => r.department?.name ?? "—",
      },
      {
        title: "Организация",
        key: "organization",
        render: (_, r) => r.organization?.name ?? "—",
      },
    ],
    [],
  );

  return (
    <Card>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        wrap
      >
        <Title level={4} style={{ margin: 0 }}>
          Сотрудники
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Добавить сотрудника
        </Button>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Поиск по ФИО"
          style={{ width: 260 }}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <Select
          allowClear
          placeholder="Организация"
          style={{ width: 280 }}
          value={orgId}
          onChange={(v) => {
            setPage(1);
            setOrgId(v);
            setDepId(undefined);
          }}
          options={orgs.map((o) => ({ value: o.id, label: o.name }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Подразделение"
          style={{ width: 320 }}
          value={depId}
          onChange={(v) => {
            setPage(1);
            setDepId(v);
          }}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
      </Space>

      <Table<Employee>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="middle"
        scroll={{ x: 700 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Всего: ${t}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <AddEmployeeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setPage(1);
          load();
        }}
      />
    </Card>
  );
}
