"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Typography, App } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { login, StrapiError } from "@/lib/strapi";

const { Title, Text } = Typography;

interface LoginValues {
  identifier: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: LoginValues) {
    setLoading(true);
    try {
      await login(values.identifier.trim(), values.password);
      message.success("Вход выполнен");
      router.replace("/dashboard");
    } catch (err) {
      const text =
        err instanceof StrapiError
          ? "Неверный логин или пароль"
          : "Не удалось подключиться к серверу";
      message.error(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 400 }} variant="borderless">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            Трейсер чистоты
          </Title>
          <Text type="secondary">Мониторинг соблюдения гигиены рук</Text>
        </div>

        <Form<LoginValues>
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          size="large"
        >
          <Form.Item
            name="identifier"
            label="Логин или email"
            rules={[{ required: true, message: "Введите логин или email" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Логин"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Пароль"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Войти
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </main>
  );
}
