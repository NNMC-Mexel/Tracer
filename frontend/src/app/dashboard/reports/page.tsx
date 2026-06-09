"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Select,
  DatePicker,
  Tabs,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  Progress,
  Typography,
  Modal,
  Popconfirm,
  App,
} from "antd";
import { useRouter } from "next/navigation";
import {
  FileExcelOutlined,
  FilePdfOutlined,
  AuditOutlined,
  TeamOutlined,
  PercentageOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getReportYears,
  getSummary,
  getJournal,
  getSessionDetail,
  monthLabel,
  CATEGORY_LABEL,
  type Summary,
  type JournalRow,
} from "@/lib/reports";
import { deleteTracer } from "@/lib/tracers";
import {
  exportSummaryExcel,
  exportSummaryPdf,
  exportJournalExcel,
} from "@/lib/reports-export";
import { listDepartments, type Department } from "@/lib/employees";
import { listQuestionnaires, LEVEL_LABEL, type Questionnaire } from "@/lib/tracers";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const { message } = App.useApp();

  const [years, setYears] = useState<number[]>([dayjs().year()]);
  const [year, setYear] = useState<number>(dayjs().year());
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [questionnaireId, setQuestionnaireId] = useState<number | undefined>();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const from = range[0].format("YYYY-MM-DD");
  const to = range[1].format("YYYY-MM-DD");
  const periodLabel = `${range[0].format("DD.MM.YYYY")}—${range[1].format("DD.MM.YYYY")}`;

  useEffect(() => {
    getReportYears().then(setYears).catch(() => {});
    listDepartments().then(setDepartments).catch(() => {});
    listQuestionnaires().then(setQuestionnaires).catch(() => {});
  }, []);

  const loadSummary = useCallback(() => {
    setLoading(true);
    getSummary({ from, to, departmentId, questionnaireId })
      .then(setSummary)
      .catch(() => message.error("Не удалось загрузить отчёт"))
      .finally(() => setLoading(false));
  }, [from, to, departmentId, questionnaireId, message]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function onYearChange(y: number) {
    setYear(y);
    // при смене года — весь год; если текущий, то текущий месяц
    if (y === dayjs().year()) {
      setRange([dayjs().startOf("month"), dayjs().endOf("month")]);
    } else {
      setRange([dayjs(`${y}-01-01`), dayjs(`${y}-12-31`)]);
    }
  }

  const monthData = useMemo(
    () =>
      (summary?.monthly ?? []).map((m) => ({
        name: monthLabel(m.month),
        "Средний %": m.avgPercent,
        Трейсеров: m.sessions,
      })),
    [summary],
  );
  const deptData = useMemo(
    () =>
      (summary?.byDepartment ?? []).slice(0, 12).map((d) => ({
        name: d.name.length > 22 ? d.name.slice(0, 20) + "…" : d.name,
        "Средний %": d.avgPercent,
      })),
    [summary],
  );

  async function doExcel() {
    if (!summary) return;
    try {
      await exportSummaryExcel(summary, { title: "Сводный отчёт по трейсерам", period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в Excel");
    }
  }
  async function doPdf() {
    if (!summary) return;
    try {
      await exportSummaryPdf(summary, { title: "Сводный отчёт по трейсерам", period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в PDF");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Space wrap size="middle" align="end" style={{ width: "100%" }}>
          <div>
            <Text strong>Год</Text>
            <br />
            <Select
              style={{ width: 110, marginTop: 4 }}
              value={year}
              onChange={onYearChange}
              options={years.map((y) => ({ value: y, label: `${y} г.` }))}
            />
          </div>
          <div>
            <Text strong>Период</Text>
            <br />
            <RangePicker
              style={{ marginTop: 4 }}
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
              format="DD.MM.YYYY"
              allowClear={false}
            />
          </div>
          <Space size={4}>
            <Button size="small" onClick={() => setRange([dayjs().startOf("month"), dayjs().endOf("month")])}>
              Месяц
            </Button>
            <Button size="small" onClick={() => setRange([dayjs(`${year}-01-01`), dayjs(`${year}-12-31`)])}>
              Год
            </Button>
          </Space>
          <div>
            <Text strong>Отдел</Text>
            <br />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Все отделы"
              style={{ width: 260, marginTop: 4 }}
              value={departmentId}
              onChange={setDepartmentId}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          <div>
            <Text strong>Опросник</Text>
            <br />
            <Select
              allowClear
              placeholder="Все опросники"
              style={{ width: 240, marginTop: 4 }}
              value={questionnaireId}
              onChange={setQuestionnaireId}
              options={questionnaires.map((q) => ({ value: q.id, label: q.name }))}
            />
          </div>
          <Space>
            <Button icon={<FileExcelOutlined />} onClick={doExcel}>
              Excel
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={doPdf}>
              PDF
            </Button>
          </Space>
        </Space>
      </Card>

      <Tabs
        items={[
          { key: "overview", label: "Общая", children: <Overview summary={summary} loading={loading} monthData={monthData} deptData={deptData} /> },
          { key: "journal", label: "Журнал", children: <Journal from={from} to={to} departmentId={departmentId} questionnaireId={questionnaireId} periodLabel={periodLabel} /> },
        ]}
      />
    </div>
  );
}

function Overview({
  summary,
  loading,
  monthData,
  deptData,
}: {
  summary: Summary | null;
  loading: boolean;
  monthData: { name: string; "Средний %": number; Трейсеров: number }[];
  deptData: { name: string; "Средний %": number }[];
}) {
  if (loading || !summary) return <Spin />;
  const k = summary.kpi;

  const deptColumns: ColumnsType<Summary["byDepartment"][number]> = [
    { title: "Отдел", dataIndex: "name", key: "name" },
    { title: "Трейсеров", dataIndex: "sessions", key: "sessions", width: 100 },
    {
      title: "Средний %",
      dataIndex: "avgPercent",
      key: "avg",
      width: 160,
      render: (v: number) => <Progress percent={v} size="small" />,
      sorter: (a, b) => a.avgPercent - b.avgPercent,
    },
    {
      title: "Охват",
      key: "coverage",
      width: 160,
      render: (_, d) =>
        d.coverage == null ? (
          "—"
        ) : (
          <Space size={4}>
            <Progress percent={d.coverage} size="small" status="active" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {d.auditedEmployees}/{d.totalEmployees}
            </Text>
          </Space>
        ),
      sorter: (a, b) => (a.coverage ?? 0) - (b.coverage ?? 0),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card><Statistic title="Трейсеров" value={k.sessions} prefix={<AuditOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Проверено сотрудников" value={k.subjects} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Средний %" value={k.avgPercent} suffix="%" prefix={<PercentageOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Text type="secondary">Уровни</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color="green">Высокий: {k.levelCounts.high}</Tag>
              <Tag color="gold">Средний: {k.levelCounts.medium}</Tag>
              <Tag color="red">Низкий: {k.levelCounts.low}</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Динамика по месяцам">
        {monthData.length === 0 ? (
          <Text type="secondary">Нет данных за период</Text>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <RTooltip />
              <Line type="monotone" dataKey="Средний %" stroke="#1677ff" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Сравнение отделов (средний %)">
        {deptData.length === 0 ? (
          <Text type="secondary">Нет данных за период</Text>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, deptData.length * 32)}>
            <BarChart layout="vertical" data={deptData} margin={{ left: 24, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
              <RTooltip />
              <Bar dataKey="Средний %" fill="#1677ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="По отделам">
        <Table
          rowKey="name"
          size="small"
          columns={deptColumns}
          dataSource={summary.byDepartment}
          pagination={false}
        />
      </Card>

      <Card title="По опросникам">
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          dataSource={summary.byQuestionnaire}
          columns={[
            { title: "Опросник", dataIndex: "name", key: "name" },
            { title: "Трейсеров", dataIndex: "sessions", key: "sessions", width: 120 },
            {
              title: "Средний %",
              dataIndex: "avgPercent",
              key: "avg",
              width: 200,
              render: (v: number) => <Progress percent={v} size="small" />,
            },
          ]}
        />
      </Card>

      <Card title="По категориям персонала (ВМР / СМР / ММП / ДР)">
        <Table
          rowKey="category"
          size="small"
          pagination={false}
          dataSource={summary.byCategory}
          locale={{ emptyText: "Нет данных (категории проставляются по должности)" }}
          columns={[
            {
              title: "Категория",
              dataIndex: "category",
              key: "category",
              render: (c: string) => CATEGORY_LABEL[c] ?? c,
            },
            { title: "Проверено", dataIndex: "subjects", key: "subjects", width: 120 },
            {
              title: "Средний %",
              dataIndex: "avgPercent",
              key: "avg",
              width: 200,
              render: (v: number) => <Progress percent={v} size="small" />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

function Journal({
  from,
  to,
  departmentId,
  questionnaireId,
  periodLabel,
}: {
  from: string;
  to: string;
  departmentId?: number;
  questionnaireId?: number;
  periodLabel: string;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<JournalRow | null>(null);

  async function onDelete(r: JournalRow) {
    try {
      await deleteTracer(r.documentId);
      message.success("Трейсер удалён");
      load();
    } catch {
      message.error("Не удалось удалить трейсер");
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    getJournal({ from, to, departmentId, questionnaireId, page, pageSize: 20 })
      .then((res) => {
        setRows(res.data);
        setTotal(res.meta.pagination.total);
      })
      .catch(() => message.error("Не удалось загрузить журнал"))
      .finally(() => setLoading(false));
  }, [from, to, departmentId, questionnaireId, page, message]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(documentId: string) {
    try {
      setDetail(await getSessionDetail(documentId));
    } catch {
      message.error("Не удалось открыть трейсер");
    }
  }

  const columns: ColumnsType<JournalRow> = [
    { title: "Дата", dataIndex: "date", key: "date", width: 110, render: (d: string) => dayjs(d).format("DD.MM.YYYY") },
    { title: "Опросник", key: "q", render: (_, r) => r.questionnaire?.name ?? "—" },
    { title: "Отдел", key: "d", render: (_, r) => r.department?.name ?? "—" },
    { title: "Аудитор", dataIndex: "auditorName", key: "a", width: 150 },
    { title: "%", dataIndex: "scorePercent", key: "p", width: 70, render: (v: number) => <b>{v}%</b> },
    {
      title: "Уровень",
      key: "lvl",
      width: 110,
      render: (_, r) => {
        const l = LEVEL_LABEL[r.complianceLevel];
        return <Tag color={l?.color}>{l?.text}</Tag>;
      },
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, r) => (
        <Space size={0} onClick={(e) => e.stopPropagation()}>
          <Button
            type="text"
            icon={<EditOutlined />}
            title="Редактировать"
            onClick={() =>
              r.questionnaire?.slug &&
              router.push(`/dashboard/tracers/${r.questionnaire.slug}?edit=${r.documentId}`)
            }
          />
          <Popconfirm
            title="Удалить трейсер?"
            description="Действие необратимо."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => onDelete(r)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="Удалить" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Журнал трейсеров"
      extra={
        <Button
          icon={<FileExcelOutlined />}
          onClick={() => exportJournalExcel(rows, periodLabel)}
        >
          Excel
        </Button>
      }
    >
      <Table<JournalRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="middle"
        onRow={(r) => ({ onClick: () => openDetail(r.documentId), style: { cursor: "pointer" } })}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showTotal: (t) => `Всего: ${t}`,
          onChange: setPage,
        }}
      />

      <Modal
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={680}
        title={detail ? `Трейсер — ${dayjs(detail.date).format("DD.MM.YYYY")}` : ""}
      >
        {detail && (
          <div>
            <p>
              <b>Опросник:</b> {detail.questionnaire?.name}
              <br />
              <b>Отдел:</b> {detail.department?.name}
              <br />
              <b>Аудитор:</b> {detail.auditorName ?? "—"}
              <br />
              <b>Результат:</b> {detail.scorePercent}%{" "}
              <Tag color={LEVEL_LABEL[detail.complianceLevel]?.color}>
                {LEVEL_LABEL[detail.complianceLevel]?.text}
              </Tag>
            </p>
            <Title level={5}>Кого проверяли</Title>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detail.subjects ?? []}
              locale={{ emptyText: "—" }}
              columns={[
                { title: "Сотрудник / субъект", key: "l", render: (_, s) => s.label ?? s.employee?.fullName ?? "—" },
                { title: "Должность", dataIndex: "positionSnapshot", key: "pos" },
                { title: "%", dataIndex: "scorePercent", key: "p", width: 70, render: (v: number) => <b>{v}%</b> },
              ]}
            />
          </div>
        )}
      </Modal>
    </Card>
  );
}
