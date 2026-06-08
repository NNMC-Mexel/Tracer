"use client";

import { Layout, Menu, Button, Typography, Spin, Avatar } from "antd";
import {
  AuditOutlined,
  BarChartOutlined,
  TeamOutlined,
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MENU = [
  { key: "/dashboard", icon: <HomeOutlined />, label: "Обзор" },
  { key: "/dashboard/employees", icon: <TeamOutlined />, label: "Сотрудники" },
  { key: "/dashboard/tracers", icon: <AuditOutlined />, label: "Трейсеры" },
  { key: "/dashboard/reports", icon: <BarChartOutlined />, label: "Отчёты" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // подсветка пункта меню по наиболее длинному совпадению пути
  const selected =
    MENU.map((m) => m.key)
      .filter((k) => pathname === k || pathname.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "/dashboard";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="light">
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          Трейсер чистоты
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          onClick={(e) => router.push(e.key)}
          items={MENU}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            paddingInline: 16,
          }}
        >
          <Avatar icon={<UserOutlined />} />
          <Text strong>{user.username}</Text>
          <Button icon={<LogoutOutlined />} onClick={signOut}>
            Выход
          </Button>
        </Header>

        <Content style={{ margin: 16 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
