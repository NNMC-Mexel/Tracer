"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
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
  Segmented,
  App,
} from "antd";
import { useRouter } from "next/navigation";
import {
  FileExcelOutlined,
  FilePdfOutlined,
  AuditOutlined,
  TeamOutlined,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  getReportYears,
  getSummary,
  getDynamics,
  getJournal,
  getSessionDetail,
  monthLabel,
  CATEGORY_LABEL,
  TREND_META,
  type Summary,
  type JournalRow,
  type Heatmap,
  type Dynamics,
  type DynCritRow,
  type DynDeptRow,
  type DynEmpRow,
  type Trend,
} from "@/lib/reports";
import { deleteTracer } from "@/lib/tracers";
import {
  exportSummaryExcel,
  exportSummaryPdf,
  exportJournalExcel,
  exportJournalPdf,
  exportSessionExcel,
  exportDynamicsExcel,
  exportDynamicsPdf,
} from "@/lib/reports-export";
import { LEVEL_LABEL, listQuestionnaires, fillBlanks, type Questionnaire } from "@/lib/tracers";
import { useAuth } from "@/lib/useAuth";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const programId = user?.program?.id;
  // ждём, пока подтянется направление пользователя — иначе первый запрос уйдёт без скоупа
  const ready = !loading;
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
    if (!ready) return;
    getReportYears(programId).then(setYears).catch(() => {});
  }, [ready, programId]);

  function onYearChange(y: number) {
    setYear(y);
    if (y === dayjs().year()) {
      setRange([dayjs().startOf("month"), dayjs().endOf("month")]);
    } else {
      setRange([dayjs(`${y}-01-01`), dayjs(`${y}-12-31`)]);
    }
  }

  return (
    <div className="report-page">
      <div className="report-hero">
        <div>
          <div className="report-eyebrow">Аналитика качества</div>
          <Title level={2} style={{ margin: 0, fontSize: 30 }}>Отчёты</Title>
          <Text type="secondary">
            Динамика соблюдения требований, проблемные зоны и результаты проверок
          </Text>
        </div>
        {user?.program?.name && (
          <Tag color="cyan" style={{ margin: 0, padding: "5px 10px", borderRadius: 8 }}>
            {user.program.name}
          </Tag>
        )}
      </div>

      <Card className="report-filter-card">
        <Space wrap size="middle" align="end" style={{ width: "100%" }}>
          <div>
            <span className="report-filter-label">Год отчёта</span>
            <Select
              style={{ width: 110, marginTop: 4 }}
              value={year}
              onChange={onYearChange}
              options={years.map((y) => ({ value: y, label: `${y} г.` }))}
            />
          </div>
          <div>
            <span className="report-filter-label">Период анализа</span>
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
        className="report-tabs"
        items={[
          { key: "summary", label: "Сводка", children: <DrillDown from={from} to={to} periodLabel={periodLabel} programId={programId} ready={ready} /> },
          { key: "dynamics", label: "Динамика", children: <DynamicsTab from={from} to={to} periodLabel={periodLabel} programId={programId} ready={ready} /> },
          { key: "journal", label: "Журнал", children: <Journal from={from} to={to} periodLabel={periodLabel} programId={programId} ready={ready} /> },
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

/** Сравнение отделов по среднему % — «динамика между отделами». */
function DeptCompareChart({ summary }: { summary: Summary }) {
  const data = (summary.byDepartment ?? [])
    .slice()
    .sort((a, b) => b.avgPercent - a.avgPercent)
    .map((d) => ({ name: d.name.length > 28 ? d.name.slice(0, 26) + "…" : d.name, "Средний %": d.avgPercent }));
  if (data.length < 2) return null;
  return (
    <Card title="Сравнение отделов (средний %)" size="small">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30)}>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 28 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
          <RTooltip />
          <Bar dataKey="Средний %" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => {
              const v = d["Средний %"];
              return <Cell key={i} fill={v >= 85 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f"} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Распределение ответов: Соответствует / Частично / Не соответствует / Неприменим. */
function AnswerBreakdown({ summary }: { summary: Summary }) {
  const c = summary.answerCounts;
  if (!c) return null;
  const total = c.full + c.partial + c.none + c.na;
  if (total === 0) return null;
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;
  const rows = [
    { label: "Соответствует", n: c.full, color: "#52c41a" },
    { label: "Частично", n: c.partial, color: "#faad14" },
    { label: "Не соответствует", n: c.none, color: "#ff4d4f" },
    ...(c.na ? [{ label: "Не требуется", n: c.na, color: "#8c8c8c" }] : []),
  ];
  return (
    <Card title="Распределение ответов" size="small">
      <Row gutter={[12, 12]}>
        {rows.map((r) => (
          <Col xs={12} md={6} key={r.label}>
            <div style={{ borderLeft: `3px solid ${r.color}`, paddingLeft: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: r.color }}>{r.n}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {r.label} · {pct(r.n)}%
              </div>
            </div>
          </Col>
        ))}
      </Row>
      <div style={{ display: "flex", height: 10, marginTop: 12, borderRadius: 4, overflow: "hidden" }}>
        {rows.map((r) =>
          r.n > 0 ? (
            <div key={r.label} style={{ width: `${pct(r.n)}%`, background: r.color }} title={`${r.label}: ${pct(r.n)}%`} />
          ) : null,
        )}
      </div>
    </Card>
  );
}

/** Проблемные вопросы — рейтинг критериев по доле провалов (худшие сверху). */
function WeakCriteria({ summary }: { summary: Summary }) {
  const list = summary.byCriterion;
  if (!list || list.length === 0) return null;
  return (
    <Card title="Проблемные вопросы — где слабее всего (худшие сверху)" size="small">
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        {list.map((c) => {
          const total = c.full + c.partial + c.none;
          const w = (n: number) => (total ? (n / total) * 100 : 0);
          const p = c.problemPct;
          const col = p >= 40 ? "#cf1322" : p >= 15 ? "#d48806" : "#8c8c8c";
          return (
            <div key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{c.text}</span>
                <span style={{ color: col, fontWeight: 700, whiteSpace: "nowrap" }}>{p}% проблем</span>
              </div>
              <div style={{ display: "flex", height: 12, marginTop: 4, borderRadius: 4, overflow: "hidden", background: "#f0f0f0" }}>
                <div style={{ width: `${w(c.full)}%`, background: "#52c41a" }} />
                <div style={{ width: `${w(c.partial)}%`, background: "#faad14" }} />
                <div style={{ width: `${w(c.none)}%`, background: "#ff4d4f" }} />
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                ✓ {c.full} соответствует · ± {c.partial} частично · ✗ {c.none} не соответствует
              </div>
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

/** Тепловая карта: отделы × вопросы (% соответствия). Красные ячейки = слабые места. */
function HeatmapCard({ summary }: { summary: Summary }) {
  const hm = summary.heatmap;
  if (!hm || hm.rows.length < 2 || hm.criteria.length === 0) return null;
  const color = (p: number | null) =>
    p == null ? "#f0f0f0" : p >= 85 ? "#52c41a" : p >= 60 ? "#faad14" : "#ff4d4f";
  const columns: ColumnsType<Heatmap["rows"][number]> = [
    { title: "Отдел", dataIndex: "name", key: "name", fixed: "left", width: 170, render: (t: string) => <span style={{ fontSize: 12 }}>{t}</span> },
    ...hm.criteria.map((c, i) => ({
      title: <Tooltip title={c.text}><span>{i + 1}</span></Tooltip>,
      key: `c${c.id}`,
      align: "center" as const,
      width: 42,
      render: (_: unknown, row: Heatmap["rows"][number]) => {
        const cell = row.cells.find((x) => x.critId === c.id);
        const p = cell?.compliancePct ?? null;
        return (
          <div style={{ background: color(p), color: p == null ? "#999" : "#fff", borderRadius: 3, fontSize: 11, padding: "3px 0", fontWeight: 600 }}>
            {p == null ? "—" : Math.round(p)}
          </div>
        );
      },
    })),
  ];
  return (
    <Card title="Тепловая карта: отделы × вопросы (% соответствия)" size="small">
      <Table
        rowKey="name"
        size="small"
        pagination={false}
        scroll={{ x: "max-content" }}
        columns={columns}
        dataSource={hm.rows}
      />
      <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
        Зелёный ≥ 85% · жёлтый 60–84% · красный &lt; 60%. Номер столбца — вопрос (наведите курсор). Красные ячейки — слабые места.
      </div>
    </Card>
  );
}

/** Проблемные трейсеры — распределение провалов по опросникам (худшие сверху, кликабельно). */
function WeakTracers({ summary, onPick }: { summary: Summary; onPick: (q: { id: number; name: string }) => void }) {
  const list = (summary.byQuestionnaire ?? [])
    .filter((q) => (q.full ?? 0) + (q.partial ?? 0) + (q.none ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.problemPct ?? 0) - (a.problemPct ?? 0));
  if (list.length === 0) return null;
  return (
    <Card title="Проблемные трейсеры — где больше провалов (нажмите, чтобы увидеть вопросы)" size="small">
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        {list.map((q) => {
          const total = (q.full ?? 0) + (q.partial ?? 0) + (q.none ?? 0);
          const w = (n?: number) => (total ? ((n ?? 0) / total) * 100 : 0);
          const p = q.problemPct ?? 0;
          const col = p >= 40 ? "#cf1322" : p >= 15 ? "#d48806" : "#8c8c8c";
          return (
            <div
              key={q.id ?? q.name}
              style={{ cursor: q.id ? "pointer" : "default" }}
              onClick={() => q.id && onPick({ id: q.id, name: q.name })}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{q.name}</span>
                <span style={{ color: col, fontWeight: 700, whiteSpace: "nowrap" }}>{p}% проблем ›</span>
              </div>
              <div style={{ display: "flex", height: 12, marginTop: 4, borderRadius: 4, overflow: "hidden", background: "#f0f0f0" }}>
                <div style={{ width: `${w(q.full)}%`, background: "#52c41a" }} />
                <div style={{ width: `${w(q.partial)}%`, background: "#faad14" }} />
                <div style={{ width: `${w(q.none)}%`, background: "#ff4d4f" }} />
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                ✓ {q.full ?? 0} соответствует · ± {q.partial ?? 0} частично · ✗ {q.none ?? 0} не соответствует
              </div>
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

/** Проваливающийся отчёт: Трейсеры → Отделы → Сотрудники. */
function DrillDown({ from, to, periodLabel, programId, ready }: { from: string; to: string; periodLabel: string; programId?: number; ready: boolean }) {
  const { message } = App.useApp();
  const [overall, setOverall] = useState<Summary | null>(null);
  const [tracer, setTracer] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selQ, setSelQ] = useState<{ id: number; name: string } | null>(null);
  const [selDept, setSelDept] = useState<{ id?: number; name: string } | null>(null);
  const [deptSummary, setDeptSummary] = useState<Summary | null>(null);

  // уровень 2 — отчёт строго по выбранному отделу (для «проблемных вопросов» отдела)
  useEffect(() => {
    if (!selQ || !selDept?.id) {
      setDeptSummary(null);
      return;
    }
    getSummary({ from, to, questionnaireId: selQ.id, departmentId: selDept.id, programId })
      .then(setDeptSummary)
      .catch(() => {});
  }, [selQ, selDept, from, to, programId]);

  // уровень 0 — список трейсеров
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    getSummary({ from, to, programId })
      .then(setOverall)
      .catch(() => message.error("Не удалось загрузить отчёт"))
      .finally(() => setLoading(false));
    setSelQ(null);
    setSelDept(null);
  }, [ready, from, to, programId, message]);

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

  // экспорт строго по текущему уровню (общий / трейсер / трейсер+отдел)
  async function exportData(): Promise<{ s: Summary; title: string } | null> {
    if (selQ && selDept?.id) {
      const s = await getSummary({ from, to, questionnaireId: selQ.id, departmentId: selDept.id, programId });
      return { s, title: `${selQ.name} — ${selDept.name}` };
    }
    if (selQ && tracer) return { s: tracer, title: selQ.name };
    if (overall) return { s: overall, title: "Сводный отчёт по трейсерам" };
    return null;
  }
  async function doExcel() {
    try {
      const e = await exportData();
      if (e) await exportSummaryExcel(e.s, { title: e.title, period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в Excel");
    }
  }
  async function doPdf() {
    try {
      const e = await exportData();
      if (e) await exportSummaryPdf(e.s, { title: e.title, period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в PDF");
    }
  }

  const crumbs = [
    { title: <a onClick={() => { setSelQ(null); setSelDept(null); }}>Все трейсеры</a> },
    ...(selQ ? [{ title: selDept ? <a onClick={() => setSelDept(null)}>{selQ.name}</a> : <span>{selQ.name}</span> }] : []),
    ...(selDept ? [{ title: <span>{selDept.name}</span> }] : []),
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
      <Card size="small" className="report-toolbar">
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Breadcrumb items={crumbs} />
          {exportButtons}
        </Space>
      </Card>

      {!selQ && <LevelTracers summary={overall} onPick={setSelQ} />}
      {selQ && !selDept && (
        loading || !tracer ? <Spin /> : <LevelDepartments summary={tracer} title={selQ.name} onPick={setSelDept} />
      )}
      {selQ && selDept && (
        deptSummary ? (
          <LevelEmployees summary={deptSummary} department={selDept.name} scoped />
        ) : tracer ? (
          <LevelEmployees summary={tracer} department={selDept.name} />
        ) : (
          <Spin />
        )
      )}
    </div>
  );
}

function LevelTracers({ summary, onPick }: { summary: Summary; onPick: (q: { id: number; name: string }) => void }) {
  const k = summary.kpi;
  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={12} xl={6}>
          <Card className="report-metric-card" style={{ "--metric-color": "#087f8c" } as CSSProperties}>
            <Statistic title="Проведено проверок" value={k.sessions} prefix={<AuditOutlined />} />
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card className="report-metric-card" style={{ "--metric-color": "#4c7f98" } as CSSProperties}>
            <Statistic title="Оценок сотрудников" value={k.subjects} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card className="report-metric-card" style={{ "--metric-color": "#2f855a" } as CSSProperties}>
            <Statistic title="Средний результат" value={k.avgPercent} suffix="%" />
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card className="report-metric-card" style={{ "--metric-color": "#c53030" } as CSSProperties}>
            <Statistic title="Требуют внимания" value={k.levelCounts.low ?? 0} suffix="пров." valueStyle={{ color: "#a62b2b" }} />
          </Card>
        </Col>
      </Row>

      <AnswerBreakdown summary={summary} />
      <WeakTracers summary={summary} onPick={onPick} />
      <MonthlyChart summary={summary} />
      <DeptCompareChart summary={summary} />

      <Card className="report-section-card" title="Трейсеры" extra={<Text type="secondary">Выберите строку для детализации</Text>}>
        <Table
          rowKey="name"
          size="middle"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={summary.byQuestionnaire}
          onRow={(r) => ({
            className: r.id ? "report-clickable-row" : "",
            onClick: () => r.id && onPick({ id: r.id, name: r.name }),
          })}
          columns={[
            { title: "Трейсер", dataIndex: "name", key: "name", render: (name: string) => <span className="report-row-link">{name}</span> },
            { title: "Отделов", dataIndex: "departments", key: "departments", width: 90 },
            { title: "Проведено", dataIndex: "sessions", key: "sessions", width: 100 },
            {
              title: "Свод (средний % по отделам)",
              dataIndex: "avgPercent",
              key: "avg",
              width: 240,
              render: (v: number) => <Progress percent={v} size="small" />,
            },
            { title: "", key: "go", width: 36, render: () => <RightOutlined style={{ color: "#087f8c" }} /> },
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
  onPick: (dept: { id?: number; name: string }) => void;
}) {
  const k = summary.kpi;
  return (
    <>
      <Card className="report-context-card">
        <Title level={4} style={{ marginTop: 0 }}>{title}</Title>
        <Space size="large" wrap>
          <Statistic title="Свод по трейсеру" value={k.avgPercent} suffix="%" />
          <Statistic title="Проведено" value={k.sessions} />
          <Statistic title="Проверено сотрудников" value={k.subjects} />
        </Space>
      </Card>

      <WeakCriteria summary={summary} />
      <HeatmapCard summary={summary} />
      <AnswerBreakdown summary={summary} />
      <MonthlyChart summary={summary} />
      <DeptCompareChart summary={summary} />

      <Card className="report-section-card" title="Отделы" extra={<Text type="secondary">Выберите отдел, чтобы увидеть сотрудников</Text>}>
        <Table
          rowKey="name"
          size="middle"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={summary.byDepartment}
          onRow={(r) => ({ className: "report-clickable-row", onClick: () => onPick({ id: r.departmentId, name: r.name }) })}
          columns={[
            { title: "Отдел", dataIndex: "name", key: "name", render: (name: string) => <span className="report-row-link">{name}</span> },
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
            { title: "", key: "go", width: 36, render: () => <RightOutlined style={{ color: "#087f8c" }} /> },
          ]}
        />
      </Card>

      {summary.byCategory.length > 0 && (
        <Card title="По категориям персонала (ВМР / СМР / ММП / ДР)" size="small">
          <Table
            rowKey="category"
            size="small"
            pagination={false}
            scroll={{ x: "max-content" }}
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

function LevelEmployees({ summary, department, scoped }: { summary: Summary; department: string; scoped?: boolean }) {
  // scoped: summary уже по отделу (с сервера) — берём всех; иначе фильтруем клиентски
  const people = scoped ? summary.byEmployee : summary.byEmployee.filter((e) => e.department === department);
  const avg = people.length
    ? Math.round((people.reduce((a, e) => a + e.scorePercent, 0) / people.length) * 10) / 10
    : 0;
  return (
    <>
      <Card className="report-context-card">
        <Title level={4} style={{ marginTop: 0 }}>{department}</Title>
        <Space size="large" wrap>
          <Statistic title="Средний % отдела" value={avg} suffix="%" />
          <Statistic title="Проверено сотрудников" value={people.length} />
        </Space>
      </Card>

      {scoped && <WeakCriteria summary={summary} />}

      <Card className="report-section-card" title="Сотрудники" extra={<Text type="secondary">{department}</Text>}>
        <Table
          rowKey={(r) => `${r.employeeId}-${r.scorePercent}`}
          size="middle"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: "max-content" }}
          dataSource={people}
          locale={{ emptyText: "Нет проверенных сотрудников" }}
          columns={[
            { title: "ФИО", dataIndex: "fullName", key: "fullName" },
            { title: "Отдел", dataIndex: "department", key: "department", width: 220 },
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

/** Мини-график тренда (одна серия, без легенды — строку называет её заголовок). */
function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const w = 60;
  const h = 18;
  const pad = 2;
  const vals = values ?? [];
  const n = vals.length;
  const pts = vals
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length === 0) return <span style={{ color: "#ccc" }}>—</span>;
  const x = (i: number) => pad + (n <= 1 ? (w - 2 * pad) / 2 : (i / (n - 1)) * (w - 2 * pad));
  const y = (v: number) => h - pad - (v / 100) * (h - 2 * pad);
  const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} style={{ display: "block", flex: "0 0 auto" }} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.2} fill={color} />
    </svg>
  );
}

const TREND_RANK: Record<string, number> = { persistent: 0, worsening: 1, stable: 2, improving: 3, insufficient: 4 };

/** Динамика по месяцам: пункт×месяц, отдел×месяц, сотрудник×месяц — с трендом и спарклайном. */
function DynamicsTab({ from, to, periodLabel, programId, ready }: { from: string; to: string; periodLabel: string; programId?: number; ready: boolean }) {
  const { message } = App.useApp();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [qId, setQId] = useState<number | undefined>();
  const [deptId, setDeptId] = useState<number | undefined>();
  const [deptOptions, setDeptOptions] = useState<{ value: number; label: string }[]>([]);
  const [data, setData] = useState<Dynamics | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"criteria" | "employee">("criteria");
  const [sortMode, setSortMode] = useState<"order" | "problem">("order");

  const selectedQ = questionnaires.find((q) => q.id === qId);
  const canEmployee = selectedQ?.subjectType === "employee";
  const effectiveMode = canEmployee ? mode : "criteria";

  useEffect(() => {
    if (!ready) return;
    listQuestionnaires(programId)
      .then((qs) => {
        setQuestionnaires(qs);
        setQId((prev) => prev ?? qs[0]?.id);
      })
      .catch(() => {});
  }, [ready, programId]);

  useEffect(() => {
    if (!ready || !qId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setData(null);
      }
    });
    getDynamics({ from, to, questionnaireId: qId, departmentId: deptId, programId }, controller.signal)
      .then((d) => {
        setData(d);
        if (!deptId) setDeptOptions(d.departments.filter((x) => x.departmentId).map((x) => ({ value: x.departmentId!, label: x.name })));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error(error);
          message.error("Не удалось загрузить динамику");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ready, qId, deptId, from, to, programId, message]);

  const months = data?.months ?? [];
  const deptName = deptOptions.find((o) => o.value === deptId)?.label;
  const title = `Динамика — ${selectedQ?.name ?? ""}${deptName ? " — " + deptName : ""}`;

  const cColor = (p: number | null) =>
    p == null
      ? { bg: "#f3f6f7", text: "#9aabb3", border: "#e1e8eb" }
      : p >= 85
        ? { bg: "#eaf6ef", text: "#26734c", border: "#cde8d7" }
        : p >= 60
          ? { bg: "#fff7e8", text: "#9b6618", border: "#f1dfb8" }
          : { bg: "#fff0f0", text: "#b83232", border: "#f2d0d0" };
  const box = (p: number | null) => (
    <div style={{ background: cColor(p).bg, color: cColor(p).text, border: `1px solid ${cColor(p).border}`, borderRadius: 6, fontSize: 11, padding: "4px 0", fontWeight: 700, textAlign: "center" }}>
      {p == null ? "—" : Math.round(p)}
    </div>
  );
  const trendCell = (values: (number | null)[], trend: Trend, first: number | null, last: number | null) => {
    const t = TREND_META[trend];
    return (
      <Space size={8} align="center">
        <Sparkline values={values} color={t.color} />
        <div style={{ lineHeight: 1.25 }}>
          <Tag color={t.color} style={{ marginInlineEnd: 0 }}>{t.icon} {t.label}</Tag>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            {first == null ? "—" : Math.round(first)} → {last == null ? "—" : Math.round(last)}
          </div>
        </div>
      </Space>
    );
  };
  const pctTip = (c: { month: string; avgPercent: number | null; sessions: number }) =>
    `${monthLabel(c.month)}: ${c.avgPercent == null ? "нет проверок" : Math.round(c.avgPercent) + "%"}${c.sessions ? ` · ${c.sessions} пров.` : ""}`;

  const monthHead = months.map((m) => ({
    title: <Tooltip title={m}><span>{monthLabel(m)}</span></Tooltip>,
    key: m,
    align: "center" as const,
    width: 50,
  }));

  const critColumns: ColumnsType<DynCritRow> = [
    {
      title: "Вопрос",
      key: "text",
      fixed: "left",
      width: 300,
      render: (_, r, i) => {
        const txt = r.text ?? "";
        return (
          <Tooltip title={txt}>
            <span style={{ fontSize: 12 }}>
              <b>{i + 1}.</b> {txt.length > 46 ? txt.slice(0, 44) + "…" : txt}
            </span>
          </Tooltip>
        );
      },
    },
    ...monthHead.map((h) => ({
      ...h,
      render: (_: unknown, r: DynCritRow) => {
        const c = r.cells.find((x) => x.month === h.key);
        if (!c) return box(null);
        return (
          <Tooltip title={`${monthLabel(c.month)}: ✓${c.full} ±${c.partial} ✗${c.none}${c.na ? ` · Н/Т ${c.na}` : ""}`}>{box(c.compliancePct)}</Tooltip>
        );
      },
    })),
    { title: "Тренд · было→стало", key: "trend", fixed: "right", width: 240, render: (_, r) => trendCell(r.cells.map((c) => c.compliancePct), r.trend, r.firstPct, r.lastPct) },
  ];

  const empColumns: ColumnsType<DynEmpRow> = [
    {
      title: "Сотрудник",
      key: "name",
      fixed: "left",
      width: 220,
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12 }}>{r.name}</div>
          {r.position ? <div style={{ fontSize: 11, color: "#999" }}>{r.position}</div> : null}
        </div>
      ),
    },
    {
      title: "Отдел",
      dataIndex: "department",
      key: "department",
      fixed: "left",
      width: 190,
      render: (department: string) => <span style={{ color: "#536873", fontSize: 12 }}>{department || "—"}</span>,
    },
    ...monthHead.map((h) => ({
      ...h,
      render: (_: unknown, r: DynEmpRow) => {
        const c = r.cells.find((x) => x.month === h.key);
        if (!c) return box(null);
        return <Tooltip title={pctTip(c)}>{box(c.avgPercent)}</Tooltip>;
      },
    })),
    { title: "Тренд · было→стало", key: "trend", fixed: "right", width: 240, render: (_, r) => trendCell(r.cells.map((c) => c.avgPercent), r.trend, r.firstPct, r.lastPct) },
  ];

  const deptColumns: ColumnsType<DynDeptRow> = [
    { title: "Отдел", dataIndex: "name", key: "name", fixed: "left", width: 200, render: (t: string) => <span style={{ fontSize: 12 }}>{t}</span> },
    ...monthHead.map((h) => ({
      ...h,
      render: (_: unknown, r: DynDeptRow) => {
        const c = r.cells.find((x) => x.month === h.key);
        if (!c) return box(null);
        return <Tooltip title={pctTip(c)}>{box(c.avgPercent)}</Tooltip>;
      },
    })),
    { title: "Тренд · было→стало", key: "trend", fixed: "right", width: 240, render: (_, r) => trendCell(r.cells.map((c) => c.avgPercent), r.trend, r.firstPct, r.lastPct) },
  ];

  const critRows =
    sortMode === "problem"
      ? [...(data?.rows ?? [])].sort((a, b) => TREND_RANK[a.trend] - TREND_RANK[b.trend] || (a.lastPct ?? 101) - (b.lastPct ?? 101))
      : data?.rows ?? [];

  const statsSet: (DynCritRow | DynEmpRow)[] = effectiveMode === "employee" ? data?.employees ?? [] : data?.rows ?? [];
  const cnt = (t: Trend) => statsSet.filter((r) => r.trend === t).length;

  async function doExcel() {
    if (!data) return;
    try {
      await exportDynamicsExcel(data, { title, period: periodLabel });
    } catch {
      message.error("Ошибка экспорта в Excel");
    }
  }
  async function doPdf() {
    if (!data) return;
    try {
      await exportDynamicsPdf(data, { title, period: periodLabel }, effectiveMode);
    } catch {
      message.error("Ошибка экспорта в PDF");
    }
  }

  const empty = !data || (effectiveMode === "employee" ? (data.employees?.length ?? 0) === 0 : (data.rows?.length ?? 0) === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card size="small" className="report-filter-card">
        <Space wrap size="middle" align="end" style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap size="middle" align="end">
            <div>
              <span className="report-filter-label">Трейсер</span>
              <Select
                style={{ width: 320, marginTop: 4 }}
                showSearch
                optionFilterProp="label"
                placeholder="Выберите трейсер"
                value={qId}
                onChange={(v) => { setQId(v); setDeptId(undefined); setDeptOptions([]); }}
                options={questionnaires.map((q) => ({ value: q.id, label: q.name }))}
              />
            </div>
            <div>
              <span className="report-filter-label">Отдел</span>
              <Select
                style={{ width: 240, marginTop: 4 }}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Все отделы"
                value={deptId}
                onChange={(v) => setDeptId(v)}
                options={deptOptions}
              />
            </div>
            {canEmployee && (
              <div>
                <span className="report-filter-label">Разрез</span>
                <Segmented
                  style={{ marginTop: 4 }}
                  value={effectiveMode}
                  onChange={(v) => setMode(v as "criteria" | "employee")}
                  options={[
                    { label: "По пунктам", value: "criteria" },
                    { label: "По сотрудникам", value: "employee" },
                  ]}
                />
              </div>
            )}
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} onClick={doExcel} disabled={!data || loading}>Excel</Button>
            <Button icon={<FilePdfOutlined />} onClick={doPdf} disabled={!data || loading}>PDF</Button>
          </Space>
        </Space>
        {months.length < 2 && (
          <div style={{ marginTop: 10, color: "#d48806", fontSize: 12 }}>
            Для динамики выберите период пошире — кнопкой «Год» вверху. Сейчас в периоде {months.length === 1 ? "один месяц" : "нет месяцев с данными"}.
          </div>
        )}
      </Card>

      {loading ? (
        <Spin />
      ) : empty ? (
        <Empty description={effectiveMode === "employee" ? "Нет проверенных сотрудников за период" : "Нет данных за выбранный период"} />
      ) : (
        <>
          <Card size="small" className="report-section-card">
            <Space size="large" wrap>
              <Statistic title="Держится нарушение" value={cnt("persistent")} valueStyle={{ color: "#cf1322" }} />
              <Statistic title="Исправляются" value={cnt("improving")} valueStyle={{ color: "#52c41a" }} />
              <Statistic title="Ухудшение" value={cnt("worsening")} valueStyle={{ color: "#ff4d4f" }} />
            </Space>
          </Card>

          {effectiveMode === "employee" ? (
            <Card className="report-section-card" size="small" title={`Динамика по сотрудникам${deptName ? " — " + deptName : ""} (худшие сверху)`}>
              <Table<DynEmpRow>
                rowKey="employeeId"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: true }}
                scroll={{ x: "max-content" }}
                columns={empColumns}
                dataSource={data!.employees ?? []}
              />
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                В ячейках — средний % сотрудника за месяц. Красная строка месяцами = человек не исправляется; переход 🟥→🟩 = исправился.
              </div>
            </Card>
          ) : (
            <>
              <Card
                className="report-section-card"
                size="small"
                title={`Динамика по пунктам${deptName ? " — " + deptName : " (все отделы)"}`}
                extra={
                  <Segmented
                    size="small"
                    value={sortMode}
                    onChange={(v) => setSortMode(v as "order" | "problem")}
                    options={[
                      { label: "По опроснику", value: "order" },
                      { label: "Проблемные сверху", value: "problem" },
                    ]}
                  />
                }
              >
                <Table<DynCritRow>
                  rowKey="critId"
                  size="small"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  columns={critColumns}
                  dataSource={critRows}
                />
                <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                  В ячейках — % соответствия за месяц. 🟩 ≥ 85 · 🟨 60–84 · 🟥 &lt; 60 · «—» нет проверок.
                  Красная строка месяцами = нарушение держится; переход 🟥→🟩 = исправились.
                </div>
              </Card>

              {!deptId && (data!.departments?.length ?? 0) > 1 && (
                <Card className="report-section-card" size="small" title="Динамика по отделам (средний % за месяц)">
                  <Table<DynDeptRow>
                    rowKey={(row) => row.departmentId ? `id:${row.departmentId}` : `snapshot:${row.name}`}
                    size="small"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    columns={deptColumns}
                    dataSource={data!.departments ?? []}
                  />
                  <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                    Выберите отдел выше, чтобы увидеть, какие именно пункты у него не выполняются.
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Journal({
  from,
  to,
  departmentId,
  questionnaireId,
  periodLabel,
  programId,
  ready,
}: {
  from: string;
  to: string;
  departmentId?: number;
  questionnaireId?: number;
  periodLabel: string;
  programId?: number;
  ready: boolean;
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
    if (!ready) return;
    listQuestionnaires(programId).then(setQuestionnaires).catch(() => {});
  }, [ready, programId]);

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
    if (!ready) return;
    setLoading(true);
    getJournal({ from, to, departmentId, questionnaireId: qId, auditor, programId, page, pageSize: 20 })
      .then((res) => {
        setRows(res.data);
        setTotal(res.meta.pagination.total);
      })
      .catch(() => message.error("Не удалось загрузить журнал"))
      .finally(() => setLoading(false));
  }, [ready, from, to, departmentId, qId, auditor, programId, page, message]);

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
      className="report-section-card"
      title="Журнал трейсеров"
      extra={
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={() => exportJournalExcel(rows, periodLabel)}>
            Excel
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => exportJournalPdf(rows, periodLabel)}>
            PDF
          </Button>
        </Space>
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
        scroll={{ x: "max-content" }}
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
            na: { s: "Н/Т", c: "#8c8c8c" },
          };
          const allCrit = (detail.criteriaSnapshot ?? []).slice().sort((a, b) => a.order - b.order);
          const crit = allCrit.filter((c) => c.kind !== "input");
          const inputCrit = allCrit.filter((c) => c.kind === "input");
          const isEmp = detail.questionnaire?.subjectType === "employee";
          const isBin = detail.questionnaire?.scale === "binary";
          // для обратных критериев символ/цвет = соответствие («Нет» → ✓), текст остаётся буквальным
          const dispV = (c: { invert?: boolean }, v?: string) =>
            c.invert ? (v === "full" ? "none" : v === "none" ? "full" : v) : v;
          const word = (v?: string) =>
            v === "full" ? (isBin ? "Да" : "Соотв.")
            : v === "none" ? (isBin ? "Нет" : "Не соотв.")
            : v === "partial" ? "Частично"
            : v === "na" ? "Не требуется"
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
                {detail.mkspNumber ? (
                  <>
                    <b>Номер МКСП:</b> {detail.mkspNumber}
                    <br />
                  </>
                ) : null}
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
              <Space style={{ marginBottom: 12 }} wrap>
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={() => window.open(`/print/tracer/${detail.documentId}`, "_blank")}
                >
                  Документ для печати (с подписями)
                </Button>
                <Button icon={<FileExcelOutlined />} onClick={() => exportSessionExcel(detail)}>
                  Excel
                </Button>
              </Space>

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
                        const a = ANS[dispV(c, s.answers?.[c.id] as string) as string];
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
                        const a = ANS[dispV(c, v) as string];
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
                {(detail.subjects ?? []).some((s) => Object.values(s.answers ?? {}).includes("na")) ? " · Н/Т не требуется" : ""}
              </div>
            </div>
          );
        })()}
      </Modal>
    </Card>
  );
}
