"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  Typography,
  Select,
  DatePicker,
  Input,
  Button,
  Table,
  Space,
  Tag,
  Spin,
  Result,
  App,
  Statistic,
  Alert,
} from "antd";
import { ArrowLeftOutlined, DeleteOutlined, SaveOutlined, CheckCircleFilled } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useAuth } from "@/lib/useAuth";
import { getSessionDetail } from "@/lib/reports";
import { listDepartments, type Department, type Employee } from "@/lib/employees";
import { uploadImage, STRAPI_URL } from "@/lib/strapi";
import EmployeePicker from "@/components/EmployeePicker";
import AnswerSelect from "@/components/AnswerSelect";
import PhotoCapture from "@/components/PhotoCapture";
import {
  listQuestionnaires,
  submitTracer,
  ANSWER_WEIGHT,
  LEVEL_LABEL,
  blankParts,
  type Questionnaire,
  type AnswerValue,
  type SubjectPayload,
  type TracerSessionResult,
} from "@/lib/tracers";

const { Title, Text, Paragraph } = Typography;

/** Отдел по умолчанию для чек-листа лечебного питания. */
const OLP_SLUG = "olp-nutrition";
const OLP_DEPT_NAME = "Отдел лечебного питания";

function percent(
  answers: Record<number, AnswerValue>,
  scored: { id: number; invert?: boolean }[],
): number {
  let sum = 0;
  let applicable = 0;
  for (const c of scored) {
    const v = answers[c.id];
    if (v === "na") continue; // «не требуется» — вне расчёта
    applicable++;
    if (v === undefined) continue; // не отвечено — вес 0
    let w = ANSWER_WEIGHT[v] ?? 0;
    if (c.invert) w = 1 - w; // обратный критерий: «Нет»→1, «Да»→0
    sum += w;
  }
  return applicable ? Math.round((sum / applicable) * 1000) / 10 : 0;
}

export default function TracerFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get("edit");
  const { user } = useAuth();
  const { message } = App.useApp();

  const [editSessionId, setEditSessionId] = useState<number | undefined>();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [note, setNote] = useState("");

  // чек-лист: ответы и примечания по критериям + участники
  const [checklist, setChecklist] = useState<Record<number, AnswerValue>>({});
  const [critNotes, setCritNotes] = useState<Record<number, string>>({});
  const [participants, setParticipants] = useState<Employee[]>([]);
  // поля-вписки (kind=input) — значения прочерков по критериям, один раз на трейсер
  const [inputs, setInputs] = useState<Record<number, string[]>>({});
  // фото проверки на месте (лайв-камера)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>();
  // по сотрудникам: строки и их ответы
  const [rows, setRows] = useState<Employee[]>([]);
  const [empAnswers, setEmpAnswers] = useState<Record<number, Record<number, AnswerValue>>>({});

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TracerSessionResult | null>(null);

  function initChecklist(_q: Questionnaire) {
    // Без предзаполнения — оценка ставится вручную (ничего не выбрано по умолчанию).
    setChecklist({});
    setCritNotes({});
  }

  useEffect(() => {
    listQuestionnaires()
      .then((all) => {
        const q = all.find((x) => x.slug === slug);
        if (!q) setNotFound(true);
        else {
          setQuestionnaire(q);
          if (q.subjectType === "department") initChecklist(q);
        }
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => {});
  }, []);

  // ОЛП (лечебное питание): по умолчанию привязываем к одному отделу
  useEffect(() => {
    if (editId || slug !== OLP_SLUG || departmentId || departments.length === 0) return;
    const d = departments.find((x) => x.name === OLP_DEPT_NAME);
    if (d) setDepartmentId(d.id);
  }, [slug, departments, editId, departmentId]);

  // режим редактирования: загрузка существующего трейсера
  useEffect(() => {
    if (!editId || !questionnaire) return;
    const toNumMap = (o?: Record<string, string>) => {
      const r: Record<number, AnswerValue> = {};
      if (o) for (const [k, v] of Object.entries(o)) r[Number(k)] = v as AnswerValue;
      return r;
    };
    const toStrMap = (o?: Record<string, string>) => {
      const r: Record<number, string> = {};
      if (o) for (const [k, v] of Object.entries(o)) r[Number(k)] = v;
      return r;
    };
    getSessionDetail(editId)
      .then((d) => {
        setEditSessionId(d.id);
        if (d.department?.id) setDepartmentId(d.department.id);
        if (d.date) setDate(dayjs(d.date));
        setNote(d.note ?? "");
        const inp: Record<number, string[]> = {};
        if (d.inputs)
          for (const [k, v] of Object.entries(d.inputs))
            inp[Number(k)] = Array.isArray(v) ? v : [String(v)];
        setInputs(inp);
        if (d.photo?.url) setExistingPhotoUrl(STRAPI_URL + d.photo.url);
        if (questionnaire.subjectType === "department") {
          const subj = d.subjects?.[0];
          setChecklist(toNumMap(subj?.answers));
          setCritNotes(toStrMap(subj?.notes));
          setParticipants(
            (d.participants ?? []).map(
              (p) =>
                ({
                  id: p.employeeId ?? 0,
                  fullName: p.fullName ?? "—",
                  position: p.position,
                  active: true,
                }) as Employee,
            ),
          );
        } else {
          const emps: Employee[] = [];
          const ans: Record<number, Record<number, AnswerValue>> = {};
          for (const s of d.subjects ?? []) {
            if (!s.employee) continue;
            emps.push({
              id: s.employee.id,
              fullName: s.employee.fullName,
              position: s.employee.position,
              department: s.employee.department,
              active: true,
            } as Employee);
            ans[s.employee.id] = toNumMap(s.answers);
          }
          setRows(emps);
          setEmpAnswers(ans);
        }
      })
      .catch(() => message.error("Не удалось загрузить трейсер для редактирования"));
  }, [editId, questionnaire, message]);

  const selectedDept = departments.find((d) => d.id === departmentId);
  const isEmployee = questionnaire?.subjectType === "employee";
  const globalSubjects = !!questionnaire?.globalSubjects;
  const scoredCriteria = useMemo(
    () => (questionnaire?.criteria ?? []).filter((c) => c.kind !== "input"),
    [questionnaire],
  );
  const inputCriteria = useMemo(
    () => (questionnaire?.criteria ?? []).filter((c) => c.kind === "input"),
    [questionnaire],
  );

  // смена отдела очищает выбранных людей (коллектив теперь другой)
  function changeDepartment(id: number | undefined) {
    setDepartmentId(id);
    setRows([]);
    setEmpAnswers({});
    setParticipants([]);
  }

  function addRow(emp: Employee) {
    setRows((prev) => (prev.some((e) => e.id === emp.id) ? prev : [...prev, emp]));
    setEmpAnswers((prev) => {
      if (prev[emp.id]) return prev;
      // Без предзаполнения — оценки по каждому критерию ставятся вручную.
      return { ...prev, [emp.id]: {} };
    });
  }
  function removeRow(id: number) {
    setRows((prev) => prev.filter((e) => e.id !== id));
    setEmpAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function addParticipant(emp: Employee) {
    setParticipants((prev) => (prev.some((e) => e.id === emp.id) ? prev : [...prev, emp]));
  }

  const livePercent = useMemo(() => {
    if (!questionnaire) return 0;
    if (!isEmployee) return percent(checklist, scoredCriteria);
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, e) => acc + percent(empAnswers[e.id] ?? {}, scoredCriteria), 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }, [questionnaire, isEmployee, checklist, rows, empAnswers, scoredCriteria]);

  async function onSave() {
    if (!questionnaire) return;
    if (!departmentId && !globalSubjects) {
      message.warning("Сначала выберите отдел");
      return;
    }
    // проверяем только оценочные критерии (поля-вписки заполнять необязательно)
    const allAnswered = (ans: Record<number, AnswerValue>) =>
      scoredCriteria.every((c) => ans?.[c.id]);

    let subjects: SubjectPayload[];
    if (!isEmployee) {
      if (!allAnswered(checklist)) {
        message.warning("Ответьте на все вопросы");
        return;
      }
      subjects = [
        {
          label: selectedDept?.name ?? questionnaire.name,
          department: selectedDept?.name,
          answers: checklist,
          notes: critNotes,
        },
      ];
    } else {
      if (rows.length === 0) {
        message.warning("Добавьте хотя бы одного сотрудника");
        return;
      }
      const unfinished = rows.find((e) => !allAnswered(empAnswers[e.id] ?? {}));
      if (unfinished) {
        message.warning(`Ответьте на все вопросы для: ${unfinished.fullName}`);
        return;
      }
      subjects = rows.map((e) => ({
        employeeId: e.id,
        label: e.fullName,
        position: e.position,
        department: e.department?.name ?? selectedDept?.name,
        answers: empAnswers[e.id] ?? {},
      }));
    }

    // фото проверки на месте — обязательно для нового трейсера
    if (!editSessionId && !photoFile) {
      message.warning("Сделайте фото проверки на месте");
      return;
    }

    setSaving(true);
    try {
      let photoId: number | undefined;
      if (photoFile) {
        try {
          photoId = (await uploadImage(photoFile)).id;
        } catch {
          message.error("Не удалось загрузить фото");
          setSaving(false);
          return;
        }
      }
      const res = await submitTracer({
        sessionId: editSessionId,
        questionnaireId: questionnaire.id,
        organizationId: selectedDept?.organization?.id,
        departmentId,
        date: date.format("YYYY-MM-DD"),
        time: dayjs().format("HH:mm"),
        note: note || undefined,
        inputs: Object.keys(inputs).length ? inputs : undefined,
        photoId,
        subjects,
        participants: !isEmployee
          ? participants.map((e) => ({
              employeeId: e.id,
              fullName: e.fullName,
              position: e.position,
            }))
          : undefined,
      });
      if (editSessionId) {
        message.success("Изменения сохранены");
        router.push("/dashboard/reports");
      } else {
        setResult(res);
        message.success("Трейсер сохранён");
      }
    } catch {
      message.error("Не удалось сохранить трейсер");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setResult(null);
    setRows([]);
    setEmpAnswers({});
    setParticipants([]);
    setNote("");
    if (questionnaire && !isEmployee) initChecklist(questionnaire);
  }

  if (notFound) {
    return (
      <Result
        status="404"
        title="Опросник не найден"
        extra={
          <Button type="primary" onClick={() => router.push("/dashboard/tracers")}>
            К списку
          </Button>
        }
      />
    );
  }
  if (!questionnaire) return <Spin />;

  if (result) {
    const lvl = LEVEL_LABEL[result.complianceLevel];
    return (
      <Card>
        <Result
          status={result.complianceLevel === "low" ? "warning" : "success"}
          title={`Трейсер сохранён — ${result.scorePercent}%`}
          subTitle={
            <Space>
              Уровень соответствия: <Tag color={lvl?.color}>{lvl?.text}</Tag>
            </Space>
          }
          extra={[
            <Button key="new" type="primary" onClick={resetForm}>
              Провести ещё
            </Button>,
            <Button key="list" onClick={() => router.push("/dashboard/tracers")}>
              К списку опросников
            </Button>,
          ]}
        />
        {result.subjects?.length > 1 && (
          <Table
            rowKey="id"
            size="small"
            style={{ marginTop: 8 }}
            pagination={false}
            dataSource={result.subjects}
            columns={[
              { title: "Сотрудник", key: "label", render: (_, s) => s.label ?? s.employee?.fullName },
              { title: "Результат", key: "score", width: 120, render: (_, s) => <b>{s.scorePercent}%</b> },
            ]}
          />
        )}
      </Card>
    );
  }

  const empColumns: ColumnsType<Employee> = [
    {
      title: "Сотрудник",
      key: "emp",
      fixed: "left",
      width: 240,
      onCell: (e) => {
        const done = scoredCriteria.every((c) => empAnswers[e.id]?.[c.id]);
        return { style: done ? { background: "#f6ffed" } : { background: "#fffbe6" } };
      },
      render: (_, e) => {
        const answered = scoredCriteria.filter((c) => empAnswers[e.id]?.[c.id]).length;
        const total = scoredCriteria.length;
        const done = answered === total;
        return (
          <div>
            <div style={{ fontWeight: done ? 600 : 400, color: done ? "#389e0d" : undefined }}>
              {done && <CheckCircleFilled style={{ color: "#52c41a", marginRight: 6 }} />}
              {e.fullName}
            </div>
            {e.position ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {e.position}
              </Text>
            ) : null}
            <div style={{ fontSize: 11, color: done ? "#52c41a" : "#d48806" }}>
              {done ? "готово" : `отмечено ${answered}/${total}`}
            </div>
          </div>
        );
      },
    },
    ...scoredCriteria.map((c) => ({
      title: c.text,
      key: `c${c.id}`,
      width: 160,
      render: (_: unknown, e: Employee) => (
        <AnswerSelect
          compact
          scale={questionnaire.scale}
          allowNa={questionnaire.allowNa || c.allowNa}
          invert={c.invert}
          value={empAnswers[e.id]?.[c.id]}
          onChange={(v) =>
            setEmpAnswers((prev) => ({
              ...prev,
              [e.id]: { ...prev[e.id], [c.id]: v },
            }))
          }
        />
      ),
    })),
    {
      title: "%",
      key: "pct",
      fixed: "right",
      width: 70,
      render: (_, e) => <b>{percent(empAnswers[e.id] ?? {}, scoredCriteria)}%</b>,
    },
    {
      title: "",
      key: "del",
      fixed: "right",
      width: 44,
      render: (_, e) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(e.id)} />
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Space style={{ marginBottom: 8 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => router.push("/dashboard/tracers")}
          />
          <Title level={4} style={{ margin: 0 }}>
            {questionnaire.name}
          </Title>
        </Space>
        <Space>
          <Tag color={isEmployee ? "blue" : "geekblue"}>
            {isEmployee ? "По сотрудникам" : "Чек-лист подразделения"}
          </Tag>
          {editSessionId ? <Tag color="orange">Редактирование</Tag> : null}
        </Space>

        <Space wrap size="large" style={{ marginTop: 16, width: "100%" }}>
          {!globalSubjects && (
            <div>
              <Text strong>
                Отдел <Text type="danger">*</Text>
              </Text>
              <br />
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Выберите отдел"
                style={{ width: 340, marginTop: 4 }}
                value={departmentId}
                onChange={changeDepartment}
                options={departments.map((d) => ({
                  value: d.id,
                  label: d.organization ? `${d.name} · ${d.organization.name}` : d.name,
                }))}
              />
            </div>
          )}
          <div>
            <Text strong>Дата</Text>
            <br />
            <DatePicker
              style={{ marginTop: 4 }}
              value={date}
              onChange={(d) => d && setDate(d)}
              format="DD.MM.YYYY"
              allowClear={false}
              disabledDate={(d) => !!d && d.isAfter(dayjs(), "day")}
            />
          </div>
          <div>
            <Text strong>Аудитор</Text>
            <br />
            <Input style={{ width: 200, marginTop: 4 }} value={user?.username ?? ""} disabled />
          </div>
        </Space>
      </Card>

      <Card title="Фото проверки на месте (обязательно)">
        <PhotoCapture file={photoFile} onChange={setPhotoFile} existingUrl={existingPhotoUrl} />
      </Card>

      {inputCriteria.length > 0 && (
        <Card title="Поля для заполнения (вписываются вручную, в % не входят)">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            {inputCriteria.map((c) => {
              const parts = blankParts(c.text);
              const vals = inputs[c.id] ?? [];
              const setVal = (i: number, v: string) =>
                setInputs((p) => {
                  const arr = [...(p[c.id] ?? [])];
                  arr[i] = v;
                  return { ...p, [c.id]: arr };
                });
              if (parts.length === 1) {
                // без прочерков — подпись + одно поле
                return (
                  <div key={c.id}>
                    <Text>{c.text}</Text>
                    <Input
                      size="small"
                      style={{ marginTop: 4, maxWidth: 320 }}
                      placeholder="Впишите"
                      value={vals[0] ?? ""}
                      onChange={(e) => setVal(0, e.target.value)}
                    />
                  </div>
                );
              }
              // прочерки → отдельное поле на каждый
              return (
                <div
                  key={c.id}
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, lineHeight: 2.4 }}
                >
                  {parts.map((seg, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span>{seg}</span>
                      {i < parts.length - 1 && (
                        <Input
                          size="small"
                          inputMode="numeric"
                          style={{ width: 64, textAlign: "center" }}
                          value={vals[i] ?? ""}
                          onChange={(e) => setVal(i, e.target.value)}
                        />
                      )}
                    </span>
                  ))}
                </div>
              );
            })}
          </Space>
        </Card>
      )}

      {isEmployee ? (
        <Card title={<Space>Сотрудники <Tag color="blue">{rows.length}</Tag></Space>}>
          {!departmentId ? (
            <Alert type="info" showIcon title="Сначала выберите отдел — появится его коллектив для выбора." />
          ) : (
            <>
              <div style={{ maxWidth: 560, marginBottom: 16 }}>
                <EmployeePicker
                  departmentId={departmentId}
                  onSelect={addRow}
                  excludeIds={rows.map((e) => e.id)}
                  placeholder="Выберите из коллектива отдела или найдите по ФИО"
                />
              </div>
              <Table<Employee>
                rowKey="id"
                columns={empColumns}
                dataSource={rows}
                pagination={false}
                scroll={{ x: "max-content" }}
                size="middle"
                locale={{ emptyText: "Добавьте сотрудников для оценки" }}
              />
            </>
          )}
        </Card>
      ) : (
        <>
          <Card title="Критерии">
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              {scoredCriteria.map((c, idx) => (
                <div
                  key={c.id}
                  style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={{ flex: 1, minWidth: 240 }}>
                      {idx + 1}. {c.text}
                    </Text>
                    <AnswerSelect
                      scale={questionnaire.scale}
                      allowNa={questionnaire.allowNa || c.allowNa}
                      invert={c.invert}
                      value={checklist[c.id]}
                      onChange={(v) => setChecklist((p) => ({ ...p, [c.id]: v }))}
                    />
                  </div>
                  <Input
                    size="small"
                    style={{ marginTop: 8 }}
                    placeholder="Примечание (необязательно)"
                    value={critNotes[c.id] ?? ""}
                    onChange={(e) => setCritNotes((p) => ({ ...p, [c.id]: e.target.value }))}
                  />
                </div>
              ))}
            </Space>
          </Card>

          <Card title={<Space>Проверенные сотрудники <Tag>{participants.length}</Tag></Space>}>
            <Paragraph type="secondary" style={{ marginTop: 0 }}>
              Необязательно. Чек-лист оценивает отдел (один %), но можно отметить, кого проверяли.
            </Paragraph>
            {!departmentId && !globalSubjects ? (
              <Alert type="info" showIcon title="Выберите отдел, чтобы добавить сотрудников." />
            ) : (
              <>
                <div style={{ maxWidth: 560, marginBottom: 12 }}>
                  <EmployeePicker
                    departmentId={globalSubjects ? undefined : departmentId}
                    onSelect={addParticipant}
                    excludeIds={participants.map((e) => e.id)}
                    placeholder={globalSubjects ? "Найдите сотрудника по ФИО (любой отдел)" : undefined}
                  />
                </div>
                <Space wrap>
                  {participants.map((e) => (
                    <Tag
                      key={e.id}
                      closable
                      onClose={() => setParticipants((p) => p.filter((x) => x.id !== e.id))}
                    >
                      {e.fullName}
                    </Tag>
                  ))}
                </Space>
              </>
            )}
          </Card>
        </>
      )}

      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }} align="center" wrap>
          <Space size="large">
            <Statistic title="Текущий результат" value={livePercent} suffix="%" />
            <div>
              <Text strong>Примечание к трейсеру</Text>
              <br />
              <Input.TextArea
                style={{ width: 360, marginTop: 4 }}
                rows={1}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
              />
            </div>
          </Space>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={onSave}
          >
            {editSessionId ? "Сохранить изменения" : "Сохранить трейсер"}
          </Button>
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          Результат считается на сервере:{" "}
          {questionnaire.scale === "binary"
            ? "Да = 1, Нет = 0"
            : "Соответствует = 1, Частично = 0.5, Не соответствует = 0"}
          ; % = сумма ÷ число оценочных критериев.
        </Paragraph>
      </Card>
    </div>
  );
}
