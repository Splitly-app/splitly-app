"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoomApi } from "./api";
import { Icon } from "./icon";
import { RoomEntryDialog } from "./room-entry-dialog";
import {
  findLegacyRoomTokens,
  type RecentRoom,
  readRoomHistory,
  searchRecentRooms,
  upsertRecentRoom,
  writeRoomHistory,
} from "./room-history";
import { RoomWorkspace } from "./room-workspace";
import type { MemberSession, RoomView } from "./types";

const roomHash = /^#\/room\/([0-9a-f]{64})$/;
const sessionKey = (token: string) => `splitly-member:${token}`;
const recentDateFormat = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});
const message = (error: unknown) =>
  error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ";

function Header({ newRoom }: { newRoom: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
          matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light",
    );
  }, []);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "dark" ? "#0b0d12" : "#ffffff");
    localStorage.setItem("splitly-theme", next);
    setTheme(next);
  }
  return (
    <header
      className="border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="page-shell flex items-center justify-between py-3">
        <button
          className="flex min-h-11 items-center gap-2 rounded-xl"
          onClick={newRoom}
          type="button"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            S
          </span>
          <span className="text-xl font-bold">Splitly</span>
        </button>
        <button
          aria-label={theme === "light" ? "เปิดโหมดมืด" : "เปิดโหมดสว่าง"}
          className="btn btn-outline !px-3"
          onClick={toggleTheme}
          type="button"
        >
          <Icon name={theme === "light" ? "moon" : "sun"} />
          <span className="hidden sm:inline">
            {theme === "light" ? "โหมดมืด" : "โหมดสว่าง"}
          </span>
        </button>
      </div>
    </header>
  );
}
function RecentRooms({
  rooms,
  onRemove,
}: {
  rooms: RecentRoom[];
  onRemove: (token: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = searchRecentRooms(rooms, query);
  return (
    <section aria-labelledby="recent-rooms-title" className="card card-soft">
      <h2 className="section-title" id="recent-rooms-title">
        ห้องที่เคยเปิด
      </h2>
      <p className="muted mt-1 text-sm">ค้นหาห้องที่เคยเปิดในเบราว์เซอร์นี้</p>
      <label className="field-label mt-4" htmlFor="room-search">
        ค้นหาจากชื่อห้องหรือชื่อสมาชิก
      </label>
      <input
        className="field"
        id="room-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="เช่น ทริปเชียงใหม่"
        type="search"
        value={query}
      />
      {rooms.length === 0 ? (
        <p className="muted mt-4 text-sm">ยังไม่มีห้องที่เคยเปิดบนอุปกรณ์นี้</p>
      ) : matches.length === 0 ? (
        <p className="muted mt-4 text-sm" role="status">
          ไม่พบห้องที่ตรงกับคำค้น
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {matches.map((room) => (
            <li
              className="flex min-w-0 items-center gap-2 rounded-xl border p-2"
              key={room.token}
              style={{ borderColor: "var(--border)" }}
            >
              <a
                className="min-w-0 flex-1 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                href={`#/room/${room.token}`}
              >
                <span className="block break-words font-semibold">
                  {room.name}
                </span>
                <span className="muted mt-1 block break-words text-xs">
                  {room.participants.join(", ")}
                </span>
                <span className="muted mt-1 block text-xs">
                  เปิดล่าสุด {recentDateFormat.format(room.lastOpenedAt)}
                </span>
              </a>
              <button
                aria-label={`ลบห้อง ${room.name} จากรายการในอุปกรณ์นี้`}
                className="btn btn-outline shrink-0 !px-3"
                onClick={() => onRemove(room.token)}
                type="button"
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {rooms.length > 0 && (
        <p className="muted mt-3 text-xs">
          การลบจากอุปกรณ์นี้ไม่ลบห้องของเพื่อน หากกลับเข้าห้องอีกครั้งต้องกรอก PIN ใหม่
        </p>
      )}
    </section>
  );
}

function CreateRoom({
  create,
  recentRooms,
  removeRecentRoom,
}: {
  create: (name: string, people: string[]) => Promise<void>;
  recentRooms: RecentRoom[];
  removeRecentRoom: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [people, setPeople] = useState([
    { id: "1", name: "" },
    { id: "2", name: "" },
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = people.map((person) => person.name.trim());
    if (
      cleaned.some((person) => !person) ||
      new Set(cleaned.map((person) => person.toLocaleLowerCase())).size !==
        cleaned.length
    ) {
      setError("กรุณาใส่ชื่ออย่างน้อยสองคนและไม่ใช้ชื่อซ้ำ");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await create(name, cleaned);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <main
      className="page-shell grid gap-8 py-10 lg:grid-cols-[1fr_440px] lg:gap-16 lg:py-20"
      id="main"
    >
      <section className="lg:pt-8">
        <p className="eyebrow">หารค่าใช้จ่ายกับเพื่อน</p>
        <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight sm:text-5xl">
          จ่ายกันคนละรายการ
          <br />
          <span className="text-primary">สรุปยอดให้ชัดในที่เดียว</span>
        </h1>
        <p className="muted mt-5 max-w-xl leading-8">
          เปิดห้อง ใส่ชื่อเพื่อน แล้วบันทึกว่าใครจ่ายอะไร เลือกคนที่ร่วมหารแต่ละรายการ Splitly
          จะหักกลบยอดโอนให้ทันที
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          {["ไม่ต้องสมัครสมาชิก", "แชร์ลิงก์กับเพื่อน", "คำนวณยอดสุทธิ"].map((item) => (
            <span className="chip" key={item}>
              <Icon className="size-4 text-primary" name="check" />
              {item}
            </span>
          ))}
        </div>
      </section>
      <div className="space-y-6">
        <RecentRooms onRemove={removeRecentRoom} rooms={recentRooms} />
        <section aria-labelledby="create-title" className="card">
          <p className="eyebrow">เริ่มต้นง่าย ๆ</p>
          <h2 className="section-title" id="create-title">
            สร้างห้องค่าใช้จ่าย
          </h2>
          <p className="muted mt-1 text-sm">ใส่ชื่ออย่างน้อย 2 คน แล้วส่งลิงก์ให้เพื่อน</p>
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <div>
              <label className="field-label" htmlFor="room-name">
                ชื่อห้อง <span className="muted font-normal">(ไม่บังคับ)</span>
              </label>
              <input
                autoComplete="off"
                className="field"
                id="room-name"
                maxLength={80}
                name="roomName"
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ทริปเชียงใหม่…"
                value={name}
              />
            </div>
            <fieldset>
              <legend className="field-label">คนในห้อง</legend>
              <div className="space-y-2">
                {people.map((person, index) => (
                  <div className="flex gap-2" key={person.id}>
                    <label className="sr-only" htmlFor={`person-${person.id}`}>
                      ชื่อคนที่ {index + 1}
                    </label>
                    <input
                      autoComplete="off"
                      className="field"
                      id={`person-${person.id}`}
                      maxLength={40}
                      name={`person-${index + 1}`}
                      placeholder={`ชื่อคนที่ ${index + 1}…`}
                      required
                      value={person.name}
                      onChange={(e) =>
                        setPeople((current) =>
                          current.map((item) =>
                            item.id === person.id
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    {people.length > 2 && (
                      <button
                        aria-label={`ลบชื่อคนที่ ${index + 1}`}
                        className="btn btn-outline !px-3"
                        onClick={() =>
                          setPeople((current) =>
                            current.filter((item) => item.id !== person.id),
                          )
                        }
                        type="button"
                      >
                        <Icon name="x" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            {people.length < 20 && (
              <button
                className="btn btn-quiet"
                onClick={() =>
                  setPeople((current) => [
                    ...current,
                    { id: crypto.randomUUID(), name: "" },
                  ])
                }
                type="button"
              >
                <Icon name="plus" />
                เพิ่มอีกคน
              </button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary w-full"
              disabled={pending}
              type="submit"
            >
              {pending ? "กำลังสร้างห้อง..." : "สร้างห้อง"} <Icon name="arrow" />
            </button>
          </form>
          <p
            className="muted mt-5 border-t pt-4 text-xs leading-5"
            style={{ borderColor: "var(--border)" }}
          >
            แชร์ลิงก์เฉพาะคนในกลุ่ม ผู้ที่ได้ลิงก์ก่อนสามารถตั้ง PIN ให้ชื่อที่ยังไม่มีเจ้าของได้
          </p>
        </section>
      </div>
    </main>
  );
}
export function RoomApp({ apiUrl }: { apiUrl: string }) {
  const api = useMemo(() => createRoomApi(apiUrl), [apiUrl]);
  const [token, setToken] = useState<string | null | undefined>();
  const [memberToken, setMemberToken] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const rememberRoom = useCallback((roomToken: string, nextRoom: RoomView) => {
    try {
      const storage = window.localStorage;
      const next = upsertRecentRoom(
        readRoomHistory(storage),
        roomToken,
        nextRoom,
      );
      writeRoomHistory(storage, next);
      setRecentRooms(next);
    } catch {
      // The room can still open if browser storage is unavailable.
    }
  }, []);
  useEffect(() => {
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }
    const saved = readRoomHistory(storage);
    setRecentRooms(saved);
    let active = true;
    for (const roomToken of findLegacyRoomTokens(storage)) {
      if (saved.some((room) => room.token === roomToken)) continue;
      void api.read(roomToken).then(
        (legacyRoom) => {
          try {
            if (active && storage.getItem(sessionKey(roomToken))) {
              rememberRoom(roomToken, legacyRoom);
            }
          } catch {
            // Browser storage may become unavailable while the request is running.
          }
        },
        () => {
          // Keep the member session; a temporary API failure must not erase it.
        },
      );
    }
    return () => {
      active = false;
    };
  }, [api, rememberRoom]);
  useEffect(() => {
    const readHash = () => {
      const next = roomHash.exec(window.location.hash)?.[1] ?? null;
      setToken(next);
      setMemberToken(next ? localStorage.getItem(sessionKey(next)) : null);
      setRoom(null);
      setError(null);
      setRecoveryCode(null);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);
  useEffect(() => {
    if (!token) return;
    void reload;
    let active = true;
    async function refresh() {
      try {
        const next = await api.read(token as string, memberToken ?? undefined);
        if (active) {
          setRoom(next);
          setError(null);
          if (!recorded) {
            rememberRoom(token as string, next);
            recorded = true;
          }
        }
      } catch (caught) {
        if (active) setError(message(caught));
      } finally {
        if (active) setLoading(false);
      }
    }
    let recorded = false;
    setLoading(true);
    void refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [api, token, memberToken, reload, rememberRoom]);
  async function create(name: string, participants: string[]) {
    const created = await api.create(name, participants);
    rememberRoom(created.token, created.room);
    window.location.hash = `/room/${created.token}`;
  }
  function removeRecentRoom(roomToken: string) {
    try {
      const storage = window.localStorage;
      const next = readRoomHistory(storage).filter(
        (room) => room.token !== roomToken,
      );
      writeRoomHistory(storage, next);
      storage.removeItem(sessionKey(roomToken));
      setRecentRooms(next);
    } catch {
      setRecentRooms((current) =>
        current.filter((room) => room.token !== roomToken),
      );
    }
  }
  async function acceptSession(session: MemberSession) {
    if (!token) return;
    localStorage.setItem(sessionKey(token), session.memberToken);
    setMemberToken(session.memberToken);
    setRecoveryCode(session.recoveryCode ?? null);
    setRoom(await api.read(token, session.memberToken));
  }
  function switchMember() {
    if (!token) return;
    localStorage.removeItem(sessionKey(token));
    setMemberToken(null);
    setRecoveryCode(null);
    setRoom((current) =>
      current ? { ...current, viewerParticipantId: null } : null,
    );
  }
  function newRoom() {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    setToken(null);
    setMemberToken(null);
    setRoom(null);
    setError(null);
  }
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <Header newRoom={newRoom} />
      {token === undefined ? (
        <main className="page-shell py-20 text-center" id="main">
          กำลังเตรียมหน้า...
        </main>
      ) : token === null ? (
        <CreateRoom
          create={create}
          recentRooms={recentRooms}
          removeRecentRoom={removeRecentRoom}
        />
      ) : room ? (
        <>
          {error && (
            <div className="page-shell mt-4" role="status">
              <p className="form-error">ข้อมูลล่าสุดยังโหลดไม่ได้: {error}</p>
            </div>
          )}
          {room.viewerParticipantId && memberToken ? (
            <RoomWorkspace
              api={api}
              memberToken={memberToken}
              onDismissRecovery={() => setRecoveryCode(null)}
              onSwitch={switchMember}
              recoveryCode={recoveryCode}
              room={room}
              setRoom={setRoom}
              token={token}
            />
          ) : (
            <main
              className="page-shell grid min-h-[60vh] place-content-center text-center"
              id="main"
            >
              <h1 className="text-2xl font-bold">{room.name}</h1>
              <p className="muted mt-2">เลือกชื่อและกรอก PIN เพื่อเข้าห้อง</p>
              <RoomEntryDialog
                api={api}
                onAcceptSession={acceptSession}
                onExit={newRoom}
                room={room}
                token={token}
              />
            </main>
          )}
        </>
      ) : (
        <main
          className="page-shell grid min-h-[60vh] place-content-center text-center"
          id="main"
        >
          <h1 className="text-2xl font-bold">
            {loading ? "กำลังเปิดห้อง..." : "เปิดห้องไม่ได้"}
          </h1>
          <p className="muted mt-2">{error ?? "กำลังดึงข้อมูลล่าสุดของห้อง"}</p>
          {!loading && (
            <button
              className="btn btn-primary mx-auto mt-5"
              onClick={() => setReload((value) => value + 1)}
              type="button"
            >
              ลองอีกครั้ง
            </button>
          )}
        </main>
      )}
      <footer className="page-shell muted py-8 text-center text-xs">
        Splitly · หารค่าใช้จ่ายให้ชัดเจน
      </footer>
    </div>
  );
}
