import { createClient } from "@supabase/supabase-js";
import type { MemberSession, RoomView } from "./types";

export class RoomApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createRoomApi(apiUrl: string) {
  const baseUrl = apiUrl.replace(/\/$/, "");
  async function request<T>(
    path: string,
    options: {
      method?: string;
      token?: string;
      memberToken?: string;
      body?: object;
    } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          ...(options.token ? { "x-room-token": options.token } : {}),
          ...(options.memberToken
            ? { "x-member-token": options.memberToken }
            : {}),
          ...(options.body ? { "content-type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new RoomApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง");
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "ข้อมูลไม่ถูกต้อง กรุณาตรวจแล้วลองใหม่",
        401: "PIN หรือรหัสกู้คืนไม่ถูกต้อง หรือเซสชันหมดอายุ",
        403: "เฉพาะผู้จ่ายรายการนี้เท่านั้นที่แก้ไขได้",
        404: "ไม่พบห้องหรือรายการนี้",
        409: "ชื่อนี้มีอยู่แล้ว หรือถูกเลือกไปก่อนแล้ว",
        422: "ข้อมูลไม่ถูกต้อง กรุณาตรวจแล้วลองใหม่",
        429: "ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที",
        503: "ระบบยังไม่พร้อม กรุณาลองอีกครั้ง",
      };
      throw new RoomApiError(
        response.status,
        messages[response.status] ?? "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      throw new RoomApiError(0, "รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง");
    }
    return payload.data as T;
  }
  const roomPath = "/v1/rooms/current";
  return {
    create(name: string, participants: string[]) {
      return request<{ token: string; room: RoomView }>("/v1/rooms", {
        method: "POST",
        body: { name, participants },
      });
    },
    read(token: string, memberToken?: string) {
      return request<RoomView>(roomPath, { token, memberToken });
    },
    selectMember(token: string, participantId: string, pin: string) {
      return request<MemberSession>(`${roomPath}/identity/select`, {
        method: "POST",
        token,
        body: { participantId, pin },
      });
    },
    recoverMember(
      token: string,
      participantId: string,
      recoveryCode: string,
      newPin: string,
    ) {
      return request<MemberSession>(`${roomPath}/identity/recover`, {
        method: "POST",
        token,
        body: { participantId, recoveryCode, newPin },
      });
    },
    addParticipant(token: string, name: string, pin: string) {
      return request<{ room: RoomView; session: MemberSession }>(
        `${roomPath}/participants`,
        {
          method: "POST",
          token,
          body: { name, pin },
        },
      );
    },
    addExpense(
      token: string,
      memberToken: string,
      expense: { amount: string; description: string },
    ) {
      return request<RoomView>(`${roomPath}/expenses`, {
        method: "POST",
        token,
        memberToken,
        body: expense,
      });
    },
    updateExpense(
      token: string,
      memberToken: string,
      expenseId: string,
      expense: { amount: string; description: string },
    ) {
      return request<RoomView>(`${roomPath}/expenses/${expenseId}`, {
        method: "PATCH",
        token,
        memberToken,
        body: expense,
      });
    },
    deleteExpense(token: string, memberToken: string, expenseId: string) {
      return request<RoomView>(`${roomPath}/expenses/${expenseId}`, {
        method: "DELETE",
        token,
        memberToken,
      });
    },
    setExpenseMembers(
      token: string,
      memberToken: string,
      expenseId: string,
      participantIds: string[],
    ) {
      return request<RoomView>(
        `${roomPath}/expenses/${expenseId}/participants`,
        {
          method: "PATCH",
          token,
          memberToken,
          body: { participantIds },
        },
      );
    },
    async uploadProof(
      token: string,
      memberToken: string,
      expenseId: string,
      file: File,
    ) {
      const base = `${roomPath}/expenses/${expenseId}/proof`;
      const intent = await request<{ path: string; uploadToken: string }>(
        `${base}/upload-intent`,
        {
          method: "POST",
          token,
          memberToken,
          body: { mimeType: file.type, sizeBytes: file.size },
        },
      );
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key)
        throw new RoomApiError(503, "ยังไม่ได้ตั้งค่า Supabase สำหรับอัปโหลดหลักฐาน");
      const storage = createClient(url, key).storage.from("expense-proofs");
      const upload = await storage.uploadToSignedUrl(
        intent.path,
        intent.uploadToken,
        file,
        {
          contentType: file.type,
        },
      );
      if (upload.error)
        throw new RoomApiError(503, "อัปโหลดหลักฐานไม่สำเร็จ กรุณาลองอีกครั้ง");
      await request<{ hasProof: boolean }>(`${base}/complete`, {
        method: "POST",
        token,
        memberToken,
        body: { path: intent.path },
      });
    },
    proofUrl(token: string, expenseId: string) {
      return request<{ url: string; mimeType: string }>(
        `${roomPath}/expenses/${expenseId}/proof`,
        { token },
      );
    },
  };
}
