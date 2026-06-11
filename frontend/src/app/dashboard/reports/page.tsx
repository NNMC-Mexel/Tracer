"use client";

import { useCallback, useEffect, useState } from "react";
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
  Tooltip,
  Breadcrumb,
  Empty,
  Input,
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
  PrinterOutlined,
  RightOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import {
  LineChart,
  Line,
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
import { LEVEL_LABEL, listQuestionnaires, fillBlanks, type Questionnaire } from "@/lib/tracers";
import { useAuth } from "@/lib/useAuth";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const { user } = useAuth();
  const programId = user?.program?.id;
  const [years, setYears] = useState<number[]>([dayjs().year()]);
  const [year, setYear] = useState<number>(dayjs().year());
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);

  const from = range[0].format("YYYY-MM-DD");
  const to = range[1].format("YYYY-MM-DD");
  const periodLabel = `${range[0].format("DD.MM.YYYY")}—${range[1].format("DD.MM.YYYY")}`;

  useEffect(() => {
    getReportYears(programId).then(setYears).catch(() => {});
  }, [programId]);

  function onYearChange(y: number) {
    setYear(y);
    if (y === dayjs().year()) {
      setRange([dayjs().startOf("month"), dayjs().endOf("month")]);
    } else {
      setRange([dayjs(`${y}-01-01`), dayjs(`${y}-12-31`)]);
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
        </Space>
      </Card>

      <Tabs
        items={[
          { key: "summary", label: "Сводка", children: <DrillDown from={from} to={to} periodLabel={periodLabel} programId={programId} /> },
          { key: "journal", label: "Журнал", children: <Journal from={from} to={to} periodLabel={periodLabel} programId={programId} /> },
        ]}
      />
    </div>
  );
}

function MonthlyChart({ summary }: { summary: Summary }) {
  const data = (summary.monthly ?? []).map((m) => ({
    name: monthLabel(m.month),
    "Средний %": m.avgPercent,
  }));
  if (data.length === 0) return null;
  return (
    <Card title="Динамика по месяцам" size="small">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 100]} />
          <RTooltip />
          <Line type="monotone" dataKey="Средний %" stroke="#1677ff" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Проваливающийся отчёт: Трейсеры → Отделы → Сотрудники. */
function DrillDown({ from, to, periodLabel, programId }: { from: string; to: string; periodLabel: string; programId?: number }) {
  const { message } = App.useApp();
  const [overall, setOverall] = useState<Summary | null>(null);
  const [tracer, setTracer] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selQ, setSelQ] = useState<{ id: number; name: string } | null>(null);
  const [selDept, setSelDept] = useState<string | null>(null);

  // уровень 0 — список трейсеров
  useEffect(() => {
    setLoading(true);
    getSummary({ from, to, programId })
      .then(setOverall)
      .catch(() => message.error("Не удалось загрузить отчёт"))
      .finally(() => setLoading(false));
    setSelQ(null);
    setSelDept(null);
  }, [from, to, programId, message]);

  // уровень 1/2 — по выбранному трейсеру
  useEffect(() => {
    if (!selQ) {
      setTracer(null);
      return;
    }
    setLoading(true);
    getSummary({ from, to, questionnaireId: selQ.id, programId })
      .then(setTracer)
      .catch(() => message.error("Не удалось загрузить трейсер"))
      .finally(() => setLoading(false));
    setSelDept(null);
  }, [selQ, from, to, programId, message]);

  async function doExcel() {
    const s = selQ ? tracer : overall;
    if (!s) return;
    try {
      await exportSummaryExcel(s, { title: selQ ? selQ.name : "Сводный отчёт по трейсерам", period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в Excel");
    }
  }
  async function doPdf() {
    const s = selQ ? tracer : overall;
    if (!s) return;
    try {
      await exportSummaryPdf(s, { title: selQ ? selQ.name : "Сводный отчёт по трейсерам", period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в PDF");
    }
  }

  const crumbs = [
    { title: <a onClick={() => { setSelQ(null); setSelDept(null); }}>Все трейсеры</a> },
    ...(selQ ? [{ title: selDept ? <a onClick={() => setSelDept(null)}>{selQ.name}</a> : <span>{selQ.name}</span> }] : []),
    ...(selDept ? [{ title: <span>{selDept}</span> }] : []),
  ];

  const exportButtons = (
    <Space>
      <Button icon={<FileExcelOutlined />} onClick={doExcel}>Excel</Button>
      <Button icon={<FilePdfOutlined />} onClick={doPdf}>PDF</Button>
    </Space>
  );

  if (loading && !overall) return <Spin />;
  if (!overall) return <Empty description="Нет данных" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card size="small">
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Breadcrumb items={crumbs} />
          {exportButtons}
        </Space>
      </Card>

      {!selQ && <LevelTracers summary={overall} onPick={setSelQ} />}
      {selQ && !selDept && (
        loading || !tracer ? <Spin /> : <LevelDepartments summary={tracer} title={selQ.name} onPick={setSelDept} />
      )}
      {selQ && selDept && tracer && (
        <LevelEmployees summary={tracer} department={selDept} />
      )}
    </div>
  );
}

function LevelTracers({ summary, onPick }: { summary: Summary; onPick: (q: { id: number; name: string }) => void }) {
  const k = summary.kpi;
  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <Card><Statistic title="Трейсеров проведено" value={k.sessions} prefix={<AuditOutlined />} /></Card>
        </Col>
        <Col xs={12} md={8}>
          <Card><Statistic title="Проверено сотрудников" value={k.subjects} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} md={8}>
          <Card><Statistic title="Средний % (по отделам)" value={k.avgPercent} suffix="%" prefix={<PercentageOutlined />} /></Card>
        </Col>
      </Row>

      <Card title="Трейсеры — нажмите, чтобы провалиться">
        <Table
          rowKey="name"
          size="middle"
          pagination={false}
          dataSource={summary.byQuestionnaire}
          onRow={(r) => ({
            style: { cursor: r.id ? "pointer" : "default" },
            onClick: () => r.id && onPick({ id: r.id, name: r.name }),
          })}
          columns={[
            { title: "Трейсер", dataIndex: "name", key: "name" },
            { title: "Отделов", dataIndex: "departments", key: "departments", width: 90 },
            { title: "Проведено", dataIndex: "sessions", key: "sessions", width: 100 },
            {
              title: "Свод (средний % по отделам)",
              dataIndex: "avgPercent",
              key: "avg",
              width: 240,
              render: (v: number) => <Progress percent={v} size="small" />,
            },
            { title: "", key: "go", width: 36, render: () => <RightOutlined style={{ color: "#bbb" }} /> },
          ]}
        />
      </Card>
    </>
  );
}

function LevelDepartments({
  summary,
  title,
  onPick,
}: {
  summary: Summary;
  title: string;
  onPick: (dept: string) => void;
}) {
  const k = summary.kpi;
  return (
    <>
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>{title}</Title>
        <Space size="large" wrap>
          <Statistic title="Свод по трейсеру" value={k.avgPercent} suffix="%" />
          <Statistic title="Проведено" value={k.sessions} />
          <Statistic title="Проверено сотрудников" value={k.subjects} />
        </Space>
      </Card>

      <MonthlyChart summary={summary} />

      <Card title="Отделы — нажмите, чтобы увидеть сотрудников">
        <Table
          rowKey="name"
          size="middle"
          pagination={false}
          dataSource={summary.byDepartment}
          onRow={(r) => ({ style: { cursor: "pointer" }, onClick: () => onPick(r.name) })}
          columns={[
            { title: "Отдел", dataIndex: "name", key: "name" },
            { title: "Проведено", dataIndex: "sessions", key: "sessions", width: 100 },
            {
              title: "Средний %",
              dataIndex: "avgPercent",
              key: "avg",
              width: 180,
              sorter: (a, b) => a.avgPercent - b.avgPercent,
              render: (v: number) => <Progress percent={v} size="small" />,
            },
            {
              title: "Охват",
              key: "coverage",
              width: 170,
              render: (_, d) =>
                d.coverage == null ? "—" : (
                  <Space size={4}>
                    <Progress percent={d.coverage} size="small" status="active" />
                    <Text type="secondary" style={{ fontSize: 12 }}>{d.auditedEmployees}/{d.totalEmployees}</Text>
                  </Space>
                ),
            },
            { title: "", key: "go", width: 36, render: () => <RightOutlined style={{ color: "#bbb" }} /> },
          ]}
        />
      </Card>

      {summary.byCategory.length > 0 && (
        <Card title="По категориям персонала (ВМР / СМР / ММП / ДР)" size="small">
          <Table
            rowKey="category"
            size="small"
            pagination={false}
            dataSource={summary.byCategory}
            columns={[
              { title: "Категория", dataIndex: "category", key: "category", render: (c: string) => CATEGORY_LABEL[c] ?? c },
              { title: "Проверено", dataIndex: "subjects", key: "subjects", width: 120 },
              { title: "Средний %", dataIndex: "avgPercent", key: "avg", width: 180, render: (v: number) => <Progress percent={v} size="small" /> },
            ]}
          />
        </Card>
      )}
    </>
  );
}

function LevelEmployees({ summary, department }: { summary: Summary; department: string }) {
  const people = summary.byEmployee.filter((e) => e.department === department);
  const avg = people.length
    ? Math.round((people.reduce((a, e) => a + e.scorePercent, 0) / people.length) * 10) / 10
    : 0;
  return (
    <>
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>{department}</Title>
        <Space size="large" wrap>
          <Statistic title="Средний % отдела" value={avg} suffix="%" />
          <Statistic title="Проверено сотрудников" value={people.length} />
        </Space>
      </Card>

      <Card title="Сотрудники">
        <Table
          rowKey={(r) => `${r.employeeId}-${r.scorePercent}`}
          size="middle"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          dataSource={people}
          locale={{ emptyText: "Нет проверенных сотрудников" }}
          columns={[
            { title: "ФИО", dataIndex: "fullName", key: "fullName" },
            { title: "Должность", dataIndex: "position", key: "position" },
            { title: "Категория", dataIndex: "category", key: "category", width: 90 },
            {
              title: "%",
              dataIndex: "scorePercent",
              key: "p",
              width: 90,
              sorter: (a, b) => a.scorePercent - b.scorePercent,
              render: (v: number) => <b>{v}%</b>,
            },
          ]}
        />
      </Card>
    </>
  );
}

function Journal({
  from,
  to,
  departmentId,
  questionnaireId,
  periodLabel,
  programId,
}: {
  from: string;
  to: string;
  departmentId?: number;
  questionnaireId?: number;
  periodLabel: string;
  programId?: number;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<JournalRow | null>(null);
  const [auditor, setAuditor] = useState("");
  const [qId, setQId] = useState<number | undefined>(questionnaireId);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);

  useEffect(() => {
    listQuestionnaires(programId).then(setQuestionnaires).catch(() => {});
  }, [programId]);

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
    getJournal({ from, to, departmentId, questionnaireId: qId, auditor, programId, page, pageSize: 20 })
      .then((res) => {
        setRows(res.data);
        setTotal(res.meta.pagination.total);
      })
      .catch(() => message.error("Не удалось загрузить журнал"))
      .finally(() => setLoading(false));
  }, [from, to, departmentId, qId, auditor, programId, page, message]);

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
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Поиск по аудитору"
          style={{ width: 240 }}
          onSearch={(v) => { setPage(1); setAuditor(v); }}
          onChange={(e) => { if (!e.target.value) { setPage(1); setAuditor(""); } }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Все опросники"
          style={{ width: 320 }}
          value={qId}
          onChange={(v) => { setPage(1); setQId(v); }}
          options={questionnaires.map((q) => ({ value: q.id, label: q.name }))}
        />
      </Space>

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
        {detail && (() => {
          const ANS: Record<string, { s: string; c: string }> = {
            full: { s: "✓", c: "#52c41a" },
            partial: { s: "±", c: "#faad14" },
            none: { s: "✗", c: "#ff4d4f" },
            na: { s: "Н/П", c: "#8c8c8c" },
          };
          const allCrit = (detail.criteriaSnapshot ?? []).slice().sort((a, b) => a.order - b.order);
          const crit = allCrit.filter((c) => c.kind !== "input");
          const inputCrit = allCrit.filter((c) => c.kind === "input");
          const isEmp = detail.questionnaire?.subjectType === "employee";
          const isBin = detail.questionnaire?.scale === "binary";
          const word = (v?: string) =>
            v === "full" ? (isBin ? "Да" : "Соотв.")
            : v === "none" ? (isBin ? "Нет" : "Не соотв.")
            : v === "partial" ? "Частично"
            : v === "na" ? "Неприменимо"
            : "";
          return (
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
              {detail.note ? (
                <p style={{ marginTop: -6 }}>
                  <b>Примечание:</b> {detail.note}
                </p>
              ) : null}
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                style={{ marginBottom: 12 }}
                onClick={() => window.open(`/print/tracer/${detail.documentId}`, "_blank")}
              >
                Документ для печати (с подписями)
              </Button>

              <Title level={5}>Кто как ответил</Title>
              {isEmp ? (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  dataSource={detail.subjects ?? []}
                  locale={{ emptyText: "—" }}
                  columns={[
                    { title: "Сотрудник", key: "l", fixed: "left", render: (_, s) => s.label ?? s.employee?.fullName ?? "—" },
                    ...crit.map((c, i) => ({
                      title: <Tooltip title={c.text}>{i + 1}</Tooltip>,
                      key: `c${c.id}`,
                      align: "center" as const,
                      width: 44,
                      render: (_: unknown, s: NonNullable<JournalRow["subjects"]>[number]) => {
                        const a = ANS[s.answers?.[c.id] as string];
                        return a ? <span style={{ color: a.c, fontWeight: 700 }}>{a.s}</span> : "";
                      },
                    })),
                    { title: "%", dataIndex: "scorePercent", key: "p", fixed: "right", width: 60, render: (v: number) => <b>{v}%</b> },
                  ]}
                />
              ) : (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={crit}
                  columns={[
                    { title: "№", key: "n", width: 40, render: (_, __, i) => i + 1 },
                    { title: "Критерий", dataIndex: "text", key: "t" },
                    {
                      title: "Оценка",
                      key: "a",
                      width: 130,
                      render: (_, c) => {
                        const v = detail.subjects?.[0]?.answers?.[c.id] as string;
                        const a = ANS[v];
                        return a ? <span style={{ color: a.c, fontWeight: 700 }}>{a.s} {word(v)}</span> : "";
                      },
                    },
                    { title: "Примечание", key: "note", render: (_, c) => detail.subjects?.[0]?.notes?.[c.id] ?? "" },
                  ]}
                />
              )}
              {inputCrit.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Title level={5}>Поля</Title>
                  {inputCrit.map((c) => (
                    <div key={c.id} style={{ marginBottom: 4 }}>
                      {fillBlanks(c.text, detail.inputs?.[c.id])}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
                {isBin ? "✓ да · ✗ нет" : "✓ соответствует · ± частично · ✗ не соответствует"}
                {detail.questionnaire?.allowNa ? " · Н/П неприменимо" : ""}
              </div>
            </div>
          );
        })()}
      </Modal>
    </Card>
  );
}
