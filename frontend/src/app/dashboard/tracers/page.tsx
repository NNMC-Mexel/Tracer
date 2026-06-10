"use client";

import { useEffect, useState } from "react";
import { Card, Typography, Row, Col, Tag, Spin, Empty } from "antd";
import { TeamOutlined, ApartmentOutlined, RightOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { listQuestionnaires, type Questionnaire } from "@/lib/tracers";
import { useAuth } from "@/lib/useAuth";

const { Title, Paragraph, Text } = Typography;

export default function TracersListPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Questionnaire[] | null>(null);

  useEffect(() => {
    if (loading) return;
    // показываем только опросники направления пользователя (если оно задано)
    listQuestionnaires(user?.program?.id)
      .then(setItems)
      .catch(() => setItems([]));
  }, [loading, user?.program?.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>
          Проведение трейсера
          {user?.program?.name ? (
            <Tag color="purple" style={{ marginLeft: 12 }}>
              {user.program.name}
            </Tag>
          ) : null}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Выберите опросник. У каждого — своя форма и своя статистика. Результат
          считается автоматически: % = соответствует / число критериев.
        </Paragraph>
      </Card>

      {items === null ? (
        <Spin />
      ) : items.length === 0 ? (
        <Empty description="Опросники не найдены" />
      ) : (
        <Row gutter={[16, 16]}>
          {items.map((q) => (
            <Col xs={24} md={12} key={q.id}>
              <Card
                hoverable
                onClick={() => router.push(`/dashboard/tracers/${q.slug}`)}
                style={{ height: "100%" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>
                      {q.name}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Tag
                        icon={
                          q.subjectType === "employee" ? (
                            <TeamOutlined />
                          ) : (
                            <ApartmentOutlined />
                          )
                        }
                        color={q.subjectType === "employee" ? "blue" : "geekblue"}
                      >
                        {q.subjectType === "employee"
                          ? "По сотрудникам"
                          : "Чек-лист подразделения"}
                      </Tag>
                      <Tag>{q.criteria.length} критериев</Tag>
                    </div>
                  </div>
                  <RightOutlined style={{ color: "#bbb", alignSelf: "center" }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
