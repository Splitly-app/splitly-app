"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { createRoomApi } from "./api";
import type { MemberSession, RoomView } from "./types";

type Api = ReturnType<typeof createRoomApi>;
type Mode = "select" | "new" | "recover";
const pinSlots = ["one", "two", "three", "four", "five", "six"] as const;

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง";

export function RoomEntryDialog({
  api,
  room,
  token,
  onAcceptSession,
  onExit,
}: {
  api: Api;
  room: RoomView;
  token: string;
  onAcceptSession: (session: MemberSession) => Promise<void>;
  onExit: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"member" | "pin">("member");
  const [mode, setMode] = useState<Mode>("select");
  const [id, setId] = useState(room.participants[0]?.id ?? "");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinFocused, setPinFocused] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = room.participants.find((person) => person.id === id);
  const displayName = mode === "new" ? name.trim() : selected?.name;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  useEffect(() => {
    if (step === "pin") pinRef.current?.focus();
  }, [step]);

  function changeMode(next: Mode) {
    setMode(next);
    setPin("");
    setCode("");
    setError(null);
  }

  function next() {
    if (mode === "new" && !name.trim()) {
      setError("กรุณาใส่ชื่อของคุณ");
      return;
    }
    if (mode !== "new" && !selected) {
      setError("กรุณาเลือกชื่อของคุณ");
      return;
    }
    setError(null);
    setStep("pin");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN ต้องเป็นตัวเลข 6 หลัก");
      return;
    }
    if (mode === "recover" && !/^[0-9a-f]{32}$/i.test(code.trim())) {
      setError("รหัสกู้คืนต้องมี 32 ตัวอักษร");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (mode === "new") {
        const result = await api.addParticipant(token, name.trim(), pin);
        await onAcceptSession(result.session);
      } else if (mode === "recover") {
        await onAcceptSession(
          await api.recoverMember(token, id, code.trim().toLowerCase(), pin),
        );
      } else {
        await onAcceptSession(await api.selectMember(token, id, pin));
      }
    } catch (caught) {
      setError(errorText(caught));
      setPin("");
      pinRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      aria-labelledby="room-entry-title"
      className="room-entry-dialog"
      onCancel={(event) => event.preventDefault()}
      ref={dialogRef}
    >
      <div className="room-entry-progress">
        <span aria-current={step === "member" ? "step" : undefined}>
          1 เลือกชื่อ
        </span>
        <span aria-current={step === "pin" ? "step" : undefined}>
          2 กรอก PIN
        </span>
      </div>
      <p className="eyebrow mt-5">เข้าห้อง {room.name}</p>
      <h2 className="section-title mt-1" id="room-entry-title">
        {step === "member" ? "คุณคือใครในห้องนี้?" : `กรอก PIN ของ ${displayName}`}
      </h2>
      {step === "member" ? (
        <div className="mt-5">
          <fieldset>
            <legend className="field-label">เลือกชื่อของคุณ</legend>
            <div className="room-entry-names">
              {room.participants.map((person) => (
                <label className="room-entry-name" key={person.id}>
                  <input
                    checked={mode === "select" && id === person.id}
                    name="entry-member"
                    onChange={() => {
                      setId(person.id);
                      changeMode("select");
                    }}
                    type="radio"
                    value={person.id}
                  />
                  <span>{person.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {room.participants.length < 20 && (
            <div className="mt-4">
              <button
                aria-expanded={mode === "new"}
                className="btn btn-quiet"
                onClick={() => changeMode(mode === "new" ? "select" : "new")}
                type="button"
              >
                {mode === "new" ? "ใช้ชื่อที่มีอยู่" : "+ เพิ่มชื่อใหม่"}
              </button>
              {mode === "new" && (
                <div className="mt-3">
                  <label className="field-label" htmlFor="entry-new-name">
                    ชื่อของคุณ
                  </label>
                  <input
                    autoComplete="off"
                    className="field"
                    id="entry-new-name"
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </div>
              )}
            </div>
          )}
          {error && (
            <p className="form-error mt-4" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <button className="btn btn-outline" onClick={onExit} type="button">
              กลับหน้าแรก
            </button>
            <button className="btn btn-primary" onClick={next} type="button">
              ถัดไป
            </button>
          </div>
          <p className="muted mt-5 text-xs leading-5">
            แชร์ลิงก์เฉพาะคนในกลุ่ม ชื่อที่ยังไม่มี PIN จะเป็นของคนแรกที่เลือก
          </p>
        </div>
      ) : (
        <form className="mt-5" onSubmit={submit}>
          <p className="muted text-sm">
            {mode === "recover"
              ? "ใส่รหัสกู้คืนและตั้ง PIN ใหม่ 6 หลัก"
              : mode === "new" || !selected?.claimed
                ? "ตั้ง PIN 6 หลักเพื่อใช้ชื่อนี้ และเก็บรหัสกู้คืนที่จะแสดงหลังเข้าห้อง"
                : "ใส่ PIN 6 หลักของชื่อที่เลือก"}
          </p>
          {mode === "recover" && (
            <div className="mt-4">
              <label className="field-label" htmlFor="entry-recovery-code">
                รหัสกู้คืน
              </label>
              <input
                autoComplete="off"
                className="field"
                id="entry-recovery-code"
                maxLength={32}
                onChange={(event) => setCode(event.target.value)}
                value={code}
              />
            </div>
          )}
          <label className="field-label mt-5" htmlFor="entry-pin">
            {mode === "recover" ? "PIN ใหม่ 6 หลัก" : "PIN 6 หลัก"}
          </label>
          <div className="pin-entry">
            <input
              autoComplete="off"
              className="pin-entry-input"
              id="entry-pin"
              inputMode="numeric"
              maxLength={6}
              onBlur={() => setPinFocused(false)}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onFocus={() => setPinFocused(true)}
              ref={pinRef}
              required
              type="password"
              value={pin}
            />
            <span aria-hidden="true" className="pin-slots">
              {pinSlots.map((slot, index) => (
                <span
                  className={`pin-slot${pinFocused && index === Math.min(pin.length, 5) ? " pin-slot-active" : ""}`}
                  key={slot}
                >
                  {index < pin.length ? "●" : ""}
                </span>
              ))}
            </span>
          </div>
          {error && (
            <p className="form-error mt-4" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <button
              className="btn btn-outline"
              disabled={pending}
              onClick={() => {
                setStep("member");
                setPin("");
                setError(null);
              }}
              type="button"
            >
              ย้อนกลับ
            </button>
            <button
              className="btn btn-primary"
              disabled={pending}
              type="submit"
            >
              {pending
                ? "กำลังตรวจสอบ..."
                : mode === "recover"
                  ? "กู้คืนชื่อ"
                  : "เข้าห้อง"}
            </button>
          </div>
          {mode !== "new" && selected?.claimed && (
            <button
              className="btn btn-quiet mt-3"
              disabled={pending}
              onClick={() =>
                changeMode(mode === "recover" ? "select" : "recover")
              }
              type="button"
            >
              {mode === "recover" ? "กลับไปกรอก PIN" : "ลืม PIN?"}
            </button>
          )}
        </form>
      )}
    </dialog>
  );
}
