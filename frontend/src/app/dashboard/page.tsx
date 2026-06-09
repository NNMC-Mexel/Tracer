"use client";

import { Card, Typography, Row, Col, Statistic, Spin } from "antd";
import { TeamOutlined, ApartmentOutlined, BankOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listEmployees, listDepartments, listOrganizations } from "@/lib/employees";

const { Title, Paragraph } = Typography;

export default function DashboardOverview() {
  const [stats, setStats] = useState<{
    employees: number;
    departments: number;
    organizations: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      listEmployees({ pageSize: 1 }),
      listDepartments(),
      listOrganizations(),
    ])
      .then(([emp, deps, orgs]) =>
        setStats({
          employees: emp.meta.pagination.total,
          departments: deps.length,
          organizations: orgs.length,
        }),
      )
      .catch(() => setStats({ employees: 0, departments: 0, organizations: 0 }));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>
          Обзор
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Разделы: <Link href="/dashboard/employees">Сотрудники</Link> —
          справочник и добавление; <Link href="/dashboard/tracers">Трейсеры</Link> —
          проведение опросников; <Link href="/dashboard/reports">Отчёты</Link> —
          сводка, журнал и печать.
        </Paragraph>
      </Card>

      {!stats ? (
        <Spin />
      ) : (
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Сотрудников"
                value={stats.employees}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Подразделений"
                value={stats.departments}
                prefix={<ApartmentOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Организаций"
                value={stats.organizations}
                prefix={<BankOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
