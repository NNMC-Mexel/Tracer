"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Spin, Result } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "@/lib/useAuth";
import { getSessionDetail, type JournalRow } from "@/lib/reports";
import { fillBlanks } from "@/lib/tracers";
import { STRAPI_URL } from "@/lib/strapi";

const ANS_SYMBOL: Record<string, string> = { full: "+", partial: "±", none: "−", na: "Н/П" };
function answerWord(v: string | undefined, binary: boolean): string {
  if (v === "full") return binary ? "Да" : "Соответствует";
  if (v === "none") return binary ? "Нет" : "Не соответствует";
  if (v === "partial") return "Частично";
  if (v === "na") return "Неприменимо";
  return "";
}

export default function TracerPrintPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user, loading } = useAuth();
  const [data, setData] = useState<JournalRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    getSessionDetail(documentId)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [documentId]);

  if (loading || !user) return <Spin style={{ margin: 40 }} />;
  if (notFound) return <Result status="404" title="Трейсер не найден" />;
  if (!data) return <Spin style={{ margin: 40 }} />;

  const allCriteria = (data.criteriaSnapshot ?? []).slice().sort((a, b) => a.order - b.order);
  const criteria = allCriteria.filter((c) => c.kind !== "input");
  const inputCriteria = allCriteria.filter((c) => c.kind === "input");
  const isEmployee = data.questionnaire?.subjectType === "employee";
  const isBinary = data.questionnaire?.scale === "binary";
  const subjects = data.subjects ?? [];

  return (
    <div className="print-root">
      <style>{`
        .print-root { max-width: 1000px; margin: 0 auto; padding: 24px; color: #000; font-family: Arial, sans-serif; }
        .print-root h1 { font-size: 18px; text-align: center; margin: 0 0 12px; }
        .meta { margin: 8px 0 16px; font-size: 14px; line-height: 1.8; }
        .meta b { display: inline-block; min-width: 130px; }
        table.doc { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.doc th, table.doc td { border: 1px solid #000; padding: 5px 7px; vertical-align: middle; }
        table.doc th { background: #f0f0f0; }
        .qlist { font-size: 13px; margin: 10px 0 14px; }
        .qlist li { margin-bottom: 3px; }
        .sym { text-align: center; font-weight: bold; font-size: 15px; }
        .sign-line { display: inline-block; border-bottom: 1px solid #000; min-width: 180px; }
        .footer { margin-top: 18px; font-size: 13px; }
        .legend { font-size: 12px; color: #333; margin-top: 6px; }
        .no-print { margin-bottom: 16px; }
        @media print {
          .no-print { display: none !important; }
          .print-root { padding: 0; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="no-print">
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Печать
        </Button>
      </div>

      <h1>{data.questionnaire?.name ?? "Трейсер"}</h1>

      <div className="meta">
        <div><b>Отделение:</b> {data.department?.name ?? "—"}</div>
        <div><b>Дата:</b> {data.date ? dayjs(data.date).format("DD.MM.YYYY") : "—"}{data.time ? `   Время: ${data.time}` : ""}</div>
        <div><b>Аудитор:</b> {data.auditorName ?? "—"}</div>
        <div><b>Итоговый результат:</b> {data.scorePercent}%</div>
        {data.note ? <div><b>Примечание:</b> {data.note}</div> : null}
      </div>

      {data.photo?.url ? (
        <div style={{ margin: "8px 0 14px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STRAPI_URL + data.photo.url}
            alt="Фото проверки на месте"
            style={{ maxHeight: 220, maxWidth: "100%", border: "1px solid #000" }}
          />
        </div>
      ) : null}

      {isEmployee ? (
        <>
          <div className="qlist">
            <b>Вопросы:</b>
            <ol>
              {criteria.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ol>
          </div>

          <table className="doc">
            <thead>
              <tr>
                <th style={{ width: 28 }}>№</th>
                <th>ФИО</th>
                <th>Должность</th>
                {criteria.map((_, i) => (
                  <th key={i} style={{ width: 34 }}>{i + 1}</th>
                ))}
                <th style={{ width: 52 }}>%</th>
                <th style={{ width: 170 }}>Подпись</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, idx) => (
                <tr key={s.id}>
                  <td className="sym">{idx + 1}</td>
                  <td>{s.label ?? s.employee?.fullName ?? "—"}</td>
                  <td>{s.positionSnapshot ?? s.employee?.position ?? ""}</td>
                  {criteria.map((c) => (
                    <td key={c.id} className="sym">
                      {ANS_SYMBOL[s.answers?.[c.id] as string] ?? ""}
                    </td>
                  ))}
                  <td className="sym">{s.scorePercent}%</td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legend">
            Обозначения: {isBinary ? "+ да, − нет" : "+ соответствует, ± частично, − не соответствует"}
            {data.questionnaire?.allowNa ? ", Н/П неприменимо" : ""}
          </div>
        </>
      ) : (
        <table className="doc">
          <thead>
            <tr>
              <th style={{ width: 28 }}>№</th>
              <th>Критерий</th>
              <th style={{ width: 160 }}>Оценка</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, idx) => {
              const subj = subjects[0];
              const v = subj?.answers?.[c.id] as string;
              return (
                <tr key={c.id}>
                  <td className="sym">{idx + 1}</td>
                  <td>{c.text}</td>
                  <td>{answerWord(v, isBinary)}</td>
                  <td>{subj?.notes?.[c.id] ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {inputCriteria.length > 0 && (
        <table className="doc" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Заполненные поля</th>
            </tr>
          </thead>
          <tbody>
            {inputCriteria.map((c) => (
              <tr key={c.id}>
                <td>{fillBlanks(c.text, data.inputs?.[c.id])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(data.participants?.length ?? 0) > 0 && (
        <div className="footer">
          <b>Сотрудники:</b> {data.participants!.map((p) => p.fullName).join(", ")}
        </div>
      )}
    </div>
  );
}
