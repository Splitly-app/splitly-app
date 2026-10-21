import { expect, test } from "bun:test";
import {
  findLegacyRoomTokens,
  readRoomHistory,
  roomHistoryKey,
  searchRecentRooms,
  upsertRecentRoom,
  writeRoomHistory,
} from "./room-history";

const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

function memoryStorage() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

test("keeps one recent entry per room and searches room and participant names", () => {
  const first = upsertRecentRoom(
    [],
    tokenA,
    {
      name: "ทริปเชียงใหม่",
      participants: [{ name: "เมย์" }],
    },
    100,
  );
  const second = upsertRecentRoom(
    first,
    tokenB,
    {
      name: "มื้อเย็น",
      participants: [{ name: "บีม" }],
    },
    200,
  );
  const reopened = upsertRecentRoom(
    second,
    tokenA,
    {
      name: "ทริปเชียงใหม่",
      participants: [{ name: "เมย์" }, { name: "บีม" }],
    },
    300,
  );
  expect(reopened.map((room) => room.token)).toEqual([tokenA, tokenB]);
  expect(searchRecentRooms(reopened, " เชียงใหม่ ")).toHaveLength(1);
  expect(searchRecentRooms(reopened, "บีม")).toHaveLength(2);
  expect(searchRecentRooms(reopened, "ไม่มี")).toHaveLength(0);
});

test("reads only valid history and finds previously claimed rooms", () => {
  const storage = memoryStorage();
  storage.setItem(roomHistoryKey, "not-json");
  expect(readRoomHistory(storage)).toEqual([]);
  const rooms = upsertRecentRoom(
    [],
    tokenA,
    {
      name: "ห้องทดสอบ",
      participants: [{ name: "เอ" }],
    },
    100,
  );
  writeRoomHistory(storage, rooms);
  storage.setItem(`splitly-member:${tokenA}`, "member-session");
  storage.setItem("splitly-member:invalid", "member-session");
  expect(readRoomHistory(storage)).toEqual(rooms);
  expect(findLegacyRoomTokens(storage)).toEqual([tokenA]);
});
