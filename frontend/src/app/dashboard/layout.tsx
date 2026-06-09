"use client";

import { useState } from "react";
import { Layout, Menu, Button, Typography, Spin, Avatar, Drawer, Grid } from "antd";
import {
  AuditOutlined,
  BarChartOutlined,
  TeamOutlined,
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
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
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading || !user) {
    return (
      <div
        style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const isMobile = !screens.lg;

  // подсветка пункта меню по наиболее длинному совпадению пути
  const selected =
    MENU.map((m) => m.key)
      .filter((k) => pathname === k || pathname.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "/dashboard";

  const brand = (
    <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
      Трейсер чистоты
    </div>
  );

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      onClick={(e) => {
        router.push(e.key);
        setDrawerOpen(false);
      }}
      items={MENU}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider theme="light">
          {brand}
          {menu}
        </Sider>
      )}

      <Drawer
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={240}
        styles={{ body: { padding: 0 } }}
        title="Трейсер чистоты"
      >
        {menu}
      </Drawer>

      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingInline: 16,
          }}
        >
          {isMobile ? (
            <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
          ) : (
            <span />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar icon={<UserOutlined />} />
            {!isMobile && <Text strong>{user.username}</Text>}
            <Button icon={<LogoutOutlined />} onClick={signOut}>
              {isMobile ? "" : "Выход"}
            </Button>
          </div>
        </Header>

        <Content style={{ margin: isMobile ? 8 : 16 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
