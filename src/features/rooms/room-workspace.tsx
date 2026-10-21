"use client";

import Image from "next/image";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { createRoomApi } from "./api";
import { formatBaht, formatDate } from "./format";
import { Icon } from "./icon";
import type { Expense, RoomView } from "./types";

type Api = ReturnType<typeof createRoomApi>;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ";
const proofTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

type ExpenseAction = {
  mode: "create" | "edit" | "delete";
  expenseId?: string;
};

function ExpenseActionDialog({
  api,
  token,
  memberToken,
  expense,
  mode,
  onClose,
  setRoom,
}: {
  api: Api;
  token: string;
  memberToken: string;
  expense: Expense | null;
  mode: ExpenseAction["mode"];
  onClose: () => void;
  setRoom: Dispatch<SetStateAction<RoomView | null>>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState(
    expense ? (expense.amountCents / 100).toFixed(2) : "",
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = expense?.description || "ค่าใช้จ่าย";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      mode !== "delete" &&
      (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
    ) {
      setError("จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง");
      return;
    }
    setPending(true);
    setError(null);
    try {
      let room: RoomView;
      if (mode === "create") {
        room = await api.addExpense(token, memberToken, {
          amount,
          description: description.trim(),
        });
      } else if (mode === "edit" && expense) {
        room = await api.updateExpense(token, memberToken, expense.id, {
          amount,
          description: description.trim(),
        });
      } else if (mode === "delete" && expense) {
        room = await api.deleteExpense(token, memberToken, expense.id);
      } else {
        throw new Error("ไม่พบรายการนี้แล้ว");
      }
      dialogRef.current?.close();
      setRoom(room);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      aria-labelledby="expense-action-title"
      className="expense-dialog"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <h2 className="section-title" id="expense-action-title">
        {mode === "create"
          ? "เพิ่มรายการที่คุณจ่าย"
          : mode === "edit"
            ? `แก้ไขรายการ ${title}`
            : `ลบรายการ ${title}?`}
      </h2>
      {mode === "delete" && (
        <p className="muted mt-3 text-sm leading-6">
          รายการ {formatBaht(expense?.amountCents ?? 0)} จะถูกลบและคำนวณยอดโอนใหม่
          {expense?.hasProof ? " หลักฐานของรายการนี้จะถูกลบด้วย" : ""}
        </p>
      )}
      <form className="mt-5 space-y-4" onSubmit={submit}>
        {mode !== "delete" && (
          <>
            <div>
              <label
                className="field-label"
                htmlFor="expense-dialog-description"
              >
                รายการ <span className="muted font-normal">(ไม่บังคับ)</span>
              </label>
              <input
                autoComplete="off"
                className="field"
                id="expense-dialog-description"
                maxLength={120}
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="expense-dialog-amount">
                จำนวนเงิน (บาท)
              </label>
              <input
                autoComplete="off"
                className="field"
                id="expense-dialog-amount"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                required
                value={amount}
              />
            </div>
          </>
        )}
        {mode === "create" && (
          <p className="muted text-xs leading-5">
            ระบบเลือกทุกคนที่อยู่ในห้องให้ร่วมหารก่อน คุณเปลี่ยนได้จากตารางหลังบันทึก
            และแนบหลักฐานภายหลังได้
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="btn btn-outline"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            ยกเลิก
          </button>
          <button
            className={`btn ${mode === "delete" ? "btn-danger" : "btn-primary"}`}
            disabled={pending}
            type="submit"
          >
            {pending
              ? "กำลังดำเนินการ..."
              : mode === "delete"
                ? "ยืนยันการลบ"
                : mode === "create"
                  ? "เพิ่มรายการ"
                  : "บันทึก"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ExpenseEntry({
  expense,
  room,
  api,
  token,
  memberToken,
  setRoom,
  view,
  onAction,
}: {
  expense: Expense;
  room: RoomView;
  api: Api;
  token: string;
  memberToken: string | null;
  setRoom: Dispatch<SetStateAction<RoomView | null>>;
  view: (expense: Expense) => Promise<void>;
  onAction: (mode: "edit" | "delete", expenseId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payer = room.participants.find(
    (person) => person.id === expense.payerId,
  );
  const editable =
    room.viewerParticipantId === expense.payerId && !!memberToken;
  async function toggle(id: string) {
    if (!memberToken) return;
    const next = expense.participantIds.includes(id)
      ? expense.participantIds.filter((item) => item !== id)
      : [...expense.participantIds, id];
    if (!next.length) {
      setError("ต้องเหลือผู้ร่วมหารอย่างน้อย 1 คน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setRoom(
        await api.setExpenseMembers(token, memberToken, expense.id, next),
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || !memberToken) return;
    if (!proofTypes.has(file.type) || file.size < 1 || file.size > 5_000_000) {
      setError("ใช้ JPEG, PNG, WebP หรือ PDF ขนาดไม่เกิน 5 MB");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.uploadProof(token, memberToken, expense.id, file);
      setRoom(await api.read(token, memberToken));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const title = expense.description || "ค่าใช้จ่าย";
  const actions = (
    <div className="flex items-center justify-center gap-1">
      {expense.hasProof && (
        <button
          aria-label={`ดูหลักฐานรายการ ${title}`}
          className="matrix-action"
          onClick={() => void view(expense)}
          title="ดูหลักฐาน"
          type="button"
        >
          <Icon name="eye" />
        </button>
      )}
      {editable && (
        <>
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-label={`เลือกหลักฐานรายการ ${title}`}
            className="sr-only"
            onChange={(e) => void upload(e.target.files?.[0])}
            ref={fileRef}
            tabIndex={-1}
            type="file"
          />
          <button
            aria-label={`${expense.hasProof ? "เปลี่ยน" : "แนบ"}หลักฐานรายการ ${title}`}
            className="matrix-action"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            title={expense.hasProof ? "เปลี่ยนหลักฐาน" : "แนบหลักฐาน"}
            type="button"
          >
            <Icon name="upload" />
          </button>
        </>
      )}
      {!expense.hasProof && !editable && <span className="muted">—</span>}
    </div>
  );
  return (
    <tr aria-busy={busy} className="expense-row">
      <th className="matrix-expense" scope="row">
        <div className="matrix-expense-content">
          <div className="matrix-expense-text">
            <span className="font-bold">{title}</span>
            <strong className="amount">
              {formatBaht(expense.amountCents)}
            </strong>
            <span className="muted text-xs">{payer?.name} จ่าย</span>
            <span className="muted text-xs">
              {formatDate(expense.createdAt)}
            </span>
          </div>
          {editable && (
            <div className="matrix-expense-actions">
              <button
                aria-label={`แก้ไขรายการ ${title}`}
                className="expense-inline-action"
                disabled={busy}
                onClick={() => onAction("edit", expense.id)}
                type="button"
              >
                แก้ไข
              </button>
              <button
                aria-label={`ลบรายการ ${title}`}
                className="expense-inline-action expense-inline-action-danger"
                disabled={busy}
                onClick={() => onAction("delete", expense.id)}
                type="button"
              >
                ลบ
              </button>
            </div>
          )}
        </div>
        {error && (
          <span className="form-error mt-2 block font-normal" role="alert">
            {error}
          </span>
        )}
      </th>
      {room.participants.map((person) => {
        const eligible = expense.eligibleParticipantIds.includes(person.id);
        const included = expense.participantIds.includes(person.id);
        return (
          <td className="matrix-cell" key={person.id}>
            {!eligible ? (
              <span className="matrix-unavailable">
                <span aria-hidden="true">—</span>
                <span className="sr-only">ยังไม่เป็นสมาชิกตอนสร้างรายการนี้</span>
              </span>
            ) : editable ? (
              <button
                aria-label={`${person.name} ${included ? "ร่วมหาร" : "ไม่ร่วมหาร"}รายการ ${title}`}
                aria-pressed={included}
                className="matrix-toggle"
                data-included={included}
                disabled={busy}
                onClick={() => void toggle(person.id)}
                type="button"
              >
                <Icon className="size-4" name={included ? "check" : "x"} />
              </button>
            ) : (
              <span className="matrix-toggle" data-included={included}>
                <Icon className="size-4" name={included ? "check" : "x"} />
                <span className="sr-only">
                  {included ? "ร่วมหาร" : "ไม่ร่วมหาร"}
                </span>
              </span>
            )}
          </td>
        );
      })}
      <td className="matrix-cell">{actions}</td>
    </tr>
  );
}
function PersonalSettlement({ room }: { room: RoomView }) {
  const viewer = room.participants.find(
    (person) => person.id === room.viewerParticipantId,
  );
  const names = new Map(
    room.participants.map((person) => [person.id, person.name]),
  );
  const groups = [
    {
      title: "ต้องจ่าย",
      items: room.transfers.filter((item) => item.fromId === viewer?.id),
      other: (id: string) => names.get(id),
      role: "toId" as const,
    },
    {
      title: "ต้องรับ",
      items: room.transfers.filter((item) => item.toId === viewer?.id),
      other: (id: string) => names.get(id),
      role: "fromId" as const,
    },
  ];
  return (
    <section aria-labelledby="settlement-title" className="card">
      <p className="eyebrow">หลังหักกลบยอดแล้ว</p>
      <h2 className="section-title" id="settlement-title">
        ยอดโอนของฉัน
      </h2>
      {!viewer ? (
        <p className="muted mt-4 text-sm">เลือกชื่อของคุณก่อนเพื่อดูยอดที่ต้องจ่ายและรับ</p>
      ) : (
        <>
          <p className="muted mt-1 text-sm">สำหรับ {viewer.name}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <div
                className="rounded-xl p-4"
                key={group.title}
                style={{ background: "var(--surface-soft)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">
                    {group.title}{" "}
                    {group.items.length ? `(${group.items.length} คน)` : ""}
                  </h3>
                  <strong className="amount">
                    {formatBaht(
                      group.items.reduce(
                        (sum, item) => sum + item.amountCents,
                        0,
                      ),
                    )}
                  </strong>
                </div>
                {group.items.length ? (
                  <ul className="mt-3 space-y-3">
                    {group.items.map((item) => (
                      <li
                        className="flex justify-between gap-3 text-sm"
                        key={`${item.fromId}-${item.toId}`}
                      >
                        <span>
                          {group.title === "ต้องจ่าย" ? "โอนให้" : "รับจาก"}{" "}
                          {group.other(item[group.role])}
                        </span>
                        <strong className="amount">
                          {formatBaht(item.amountCents)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted mt-3 text-sm">ไม่มีเงินที่{group.title}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
export function RoomWorkspace({
  api,
  token,
  memberToken,
  room,
  recoveryCode,
  onDismissRecovery,
  onSwitch,
  setRoom,
}: {
  api: Api;
  token: string;
  memberToken: string | null;
  room: RoomView;
  recoveryCode: string | null;
  onDismissRecovery: () => void;
  onSwitch: () => void;
  setRoom: Dispatch<SetStateAction<RoomView | null>>;
}) {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [proof, setProof] = useState<{
    url: string;
    mimeType: string;
    title: string;
  } | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [expenseAction, setExpenseAction] = useState<ExpenseAction | null>(
    null,
  );
  const [matrixCanScroll, setMatrixCanScroll] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const matrixRef = useRef<HTMLElement>(null);
  const hasExpenses = room.expenses.length > 0;
  const viewer = room.participants.find(
    (person) => person.id === room.viewerParticipantId,
  );
  useEffect(() => {
    const url = new URL(
      "/",
      process.env.NEXT_PUBLIC_SHARE_ORIGIN || location.origin,
    );
    url.hash = `/room/${token}`;
    setShareUrl(url.toString());
  }, [token]);
  useEffect(() => {
    if (proof && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!proof && dialogRef.current?.open) dialogRef.current.close();
  }, [proof]);
  useEffect(() => {
    if (!hasExpenses) return;
    const viewport = matrixRef.current;
    if (!viewport) return;
    const update = () =>
      setMatrixCanScroll(viewport.scrollWidth > viewport.clientWidth + 2);
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    const table = viewport.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [hasExpenses]);
  function scrollMatrix(direction: -1 | 1) {
    matrixRef.current?.scrollBy({
      left: direction * 240,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  async function view(expense: Expense) {
    setProofError(null);
    try {
      setProof({
        ...(await api.proofUrl(token, expense.id)),
        title: expense.description || "ค่าใช้จ่าย",
      });
    } catch (caught) {
      setProofError(errorText(caught));
    }
  }
  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyError("คัดลอกลิงก์ไม่สำเร็จ กรุณาเลือกข้อความในช่องแล้วคัดลอกเอง");
    }
  }
  const activeExpense = room.expenses.find(
    (expense) => expense.id === expenseAction?.expenseId,
  );
  const entryProps = {
    api,
    token,
    memberToken,
    room,
    setRoom,
    view,
    onAction: (mode: "edit" | "delete", expenseId: string) =>
      setExpenseAction({ mode, expenseId }),
  };
  return (
    <main className="page-shell space-y-6 pb-16 pt-7 sm:pt-10" id="main">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">ห้องค่าใช้จ่าย</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{room.name}</h1>
          <p className="muted mt-2 text-sm">
            อัปเดต {formatDate(room.updatedAt)} · ตรวจข้อมูลใหม่ทุก 5 วินาที
          </p>
        </div>
        <button
          className="btn btn-outline"
          disabled={!shareUrl}
          onClick={() => void copy()}
          type="button"
        >
          <Icon name={copied ? "check" : "share"} />
          <span>{copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</span>
        </button>
      </div>
      {recoveryCode && (
        <section className="card card-soft" role="status">
          <h2 className="section-title">เก็บรหัสกู้คืนนี้ไว้</h2>
          <p className="muted mt-1 text-sm">
            รหัสจะแสดงครั้งเดียว ใช้ตั้ง PIN ใหม่เมื่อคุณลืม
          </p>
          <code
            className="mt-3 block select-all break-all rounded-xl p-3 font-mono text-sm"
            style={{ background: "var(--surface)" }}
          >
            {recoveryCode}
          </code>
          <button
            className="btn btn-primary mt-4"
            onClick={onDismissRecovery}
            type="button"
          >
            บันทึกไว้แล้ว
          </button>
        </section>
      )}
      {viewer && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl p-3"
          style={{ background: "var(--surface-soft)" }}
        >
          <span className="text-sm">
            คุณกำลังใช้ชื่อ <strong>{viewer.name}</strong>
          </span>
          <button
            className="btn btn-quiet !min-h-9 !px-2 text-sm"
            onClick={onSwitch}
            type="button"
          >
            เปลี่ยนชื่อ
          </button>
        </div>
      )}
      <section aria-labelledby="expenses-title" className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              ค่าใช้จ่ายทั้งหมด {room.expenses.length} รายการ
            </p>
            <h2 className="section-title" id="expenses-title">
              รายการในห้อง
            </h2>
          </div>
          {viewer && memberToken && (
            <button
              className="btn btn-primary"
              onClick={() => setExpenseAction({ mode: "create" })}
              type="button"
            >
              <Icon name="plus" />
              เพิ่มรายการ
            </button>
          )}
        </div>
        {room.expenses.length ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="muted text-xs" id="matrix-help">
                <span className="matrix-help-included">✓ ร่วมหาร</span>
                {" · "}
                <span className="matrix-help-excluded">× ไม่ร่วมหาร</span>
                {" · — ยังไม่อยู่ในห้อง"}
              </p>
              {matrixCanScroll && (
                <div className="flex shrink-0 gap-1">
                  <button
                    aria-label="เลื่อนตารางไปทางซ้าย"
                    className="matrix-nav"
                    onClick={() => scrollMatrix(-1)}
                    type="button"
                  >
                    <Icon className="size-4 rotate-180" name="arrow" />
                  </button>
                  <button
                    aria-label="เลื่อนตารางไปทางขวา"
                    className="matrix-nav"
                    onClick={() => scrollMatrix(1)}
                    type="button"
                  >
                    <Icon className="size-4" name="arrow" />
                  </button>
                </div>
              )}
            </div>
            <section
              aria-describedby="matrix-help"
              aria-label="ตารางรายการค่าใช้จ่ายและผู้ร่วมหาร"
              className="matrix-scroll mt-3"
              ref={matrixRef}
            >
              <table
                className="expense-matrix"
                style={{
                  minWidth: `calc(var(--matrix-name-width) + ${room.participants.length * 84 + 96}px)`,
                }}
              >
                <caption className="sr-only">
                  รายการค่าใช้จ่าย โดยชื่อสมาชิกอยู่หัวตาราง
                  เลือกเครื่องหมายถูกหรือผิดเพื่อกำหนดผู้ร่วมหาร
                </caption>
                <colgroup>
                  <col className="matrix-name-col" />
                  {room.participants.map((person) => (
                    <col className="matrix-person-col" key={person.id} />
                  ))}
                  <col className="matrix-proof-col" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="matrix-expense" scope="col">
                      รายการ / จำนวนเงิน
                    </th>
                    {room.participants.map((person) => (
                      <th
                        className="matrix-person-heading"
                        key={person.id}
                        scope="col"
                      >
                        {person.name}
                      </th>
                    ))}
                    <th className="matrix-proof-heading" scope="col">
                      หลักฐาน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {room.expenses.map((expense) => (
                    <ExpenseEntry
                      {...entryProps}
                      expense={expense}
                      key={expense.id}
                    />
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : (
          <div
            className="mt-5 rounded-xl p-6 text-center"
            style={{ background: "var(--surface-soft)" }}
          >
            <p className="font-bold">ยังไม่มีรายการในห้องนี้</p>
            <p className="muted mt-1 text-sm">เพิ่มรายการแรกเพื่อเริ่มคำนวณยอดโอน</p>
          </div>
        )}
        {proofError && (
          <p className="form-error mt-3" role="alert">
            {proofError}
          </p>
        )}
      </section>
      {expenseAction &&
        (expenseAction.mode === "create" || activeExpense) &&
        memberToken && (
          <ExpenseActionDialog
            api={api}
            expense={activeExpense ?? null}
            key={`${expenseAction.mode}:${activeExpense?.id ?? "new"}`}
            memberToken={memberToken}
            mode={expenseAction.mode}
            onClose={() => setExpenseAction(null)}
            setRoom={setRoom}
            token={token}
          />
        )}
      <PersonalSettlement room={room} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="people-title" className="card">
          <h2 className="section-title" id="people-title">
            คนในห้อง
          </h2>
          <ul
            className="mt-4 divide-y"
            style={{ borderColor: "var(--border)" }}
          >
            {room.participants.map((person) => (
              <li className="flex justify-between gap-3 py-3" key={person.id}>
                <div>
                  <strong>{person.name}</strong>
                  <p className="muted text-xs">
                    จ่ายไป {formatBaht(person.paidCents)}
                  </p>
                </div>
                <span className="amount text-sm">
                  {person.balanceCents > 0
                    ? "รับคืน "
                    : person.balanceCents < 0
                      ? "ต้องจ่าย "
                      : "ครบแล้ว"}
                  {person.balanceCents !== 0 &&
                    formatBaht(Math.abs(person.balanceCents))}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="share-title" className="card card-soft">
          <h2 className="section-title" id="share-title">
            แชร์ห้องกับเพื่อน
          </h2>
          <p className="muted mt-2 text-sm">
            คนที่มีลิงก์จะดูรายการและหลักฐานได้ ชื่อที่ยังไม่มี PIN อาจถูกเลือกโดยคนแรกที่เปิดลิงก์
          </p>
          <label className="field-label mt-4" htmlFor="share-url">
            ลิงก์ห้อง
          </label>
          <div className="flex min-w-0 gap-2">
            <input
              autoComplete="off"
              className="field min-w-0 flex-1 text-sm"
              id="share-url"
              name="shareUrl"
              onFocus={(e) => e.target.select()}
              readOnly
              value={shareUrl}
            />
            <button
              aria-label={copied ? "คัดลอกลิงก์ห้องแล้ว" : "คัดลอกลิงก์ห้อง"}
              className="btn btn-outline shrink-0 !px-3"
              disabled={!shareUrl}
              onClick={() => void copy()}
              type="button"
            >
              <Icon name={copied ? "check" : "copy"} />
            </button>
          </div>
          <p
            aria-live="polite"
            className={
              copyError ? "form-error mt-2 text-sm" : "muted mt-2 text-sm"
            }
            role={copyError ? "alert" : "status"}
          >
            {copyError ?? (copied ? "คัดลอกลิงก์ห้องแล้ว" : "")}
          </p>
        </section>
      </div>
      <dialog
        aria-label={proof ? `หลักฐานรายการ ${proof.title}` : "หลักฐาน"}
        className="proof-dialog"
        onClose={() => setProof(null)}
        ref={dialogRef}
      >
        {proof && (
          <div className="dialog-panel">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title">หลักฐาน · {proof.title}</h2>
              <button
                aria-label="ปิดหลักฐาน"
                className="btn btn-outline !px-3"
                onClick={() => dialogRef.current?.close()}
                type="button"
              >
                <Icon name="x" />
              </button>
            </div>
            {proof.mimeType === "application/pdf" ? (
              <a
                className="btn btn-primary"
                href={proof.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                เปิด PDF ในแท็บใหม่
              </a>
            ) : (
              <Image
                alt={`หลักฐานรายการ ${proof.title}`}
                height={900}
                src={proof.url}
                unoptimized
                width={1200}
              />
            )}
          </div>
        )}
      </dialog>
    </main>
  );
}
