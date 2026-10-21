export const roomHistoryKey = "splitly-rooms:v1";

export type RecentRoom = {
  token: string;
  name: string;
  participants: string[];
  lastOpenedAt: number;
};

const roomTokenPattern = /^[0-9a-f]{64}$/;

function isRecentRoom(value: unknown): value is RecentRoom {
  if (!value || typeof value !== "object") return false;
  const room = value as Partial<RecentRoom>;
  return (
    typeof room.token === "string" &&
    roomTokenPattern.test(room.token) &&
    typeof room.name === "string" &&
    Array.isArray(room.participants) &&
    room.participants.every((name) => typeof name === "string") &&
    typeof room.lastOpenedAt === "number" &&
    Number.isFinite(room.lastOpenedAt)
  );
}

export function readRoomHistory(
  storage: Pick<Storage, "getItem">,
): RecentRoom[] {
  try {
    const raw = storage.getItem(roomHistoryKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(isRecentRoom)
          .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      : [];
  } catch {
    return [];
  }
}

export function writeRoomHistory(
  storage: Pick<Storage, "setItem">,
  rooms: RecentRoom[],
): void {
  try {
    storage.setItem(roomHistoryKey, JSON.stringify(rooms));
  } catch {
    // Browsers can disable storage; the current page still remains usable.
  }
}

export function upsertRecentRoom(
  rooms: RecentRoom[],
  token: string,
  room: { name: string; participants: { name: string }[] },
  lastOpenedAt = Date.now(),
): RecentRoom[] {
  if (!roomTokenPattern.test(token)) return rooms;
  return [
    {
      token,
      name: room.name,
      participants: room.participants.map((person) => person.name),
      lastOpenedAt,
    },
    ...rooms.filter((saved) => saved.token !== token),
  ].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export function searchRecentRooms(
  rooms: RecentRoom[],
  query: string,
): RecentRoom[] {
  const needle = query.trim().toLocaleLowerCase("th-TH");
  return rooms.filter((room) =>
    [room.name, ...room.participants].some((value) =>
      value.toLocaleLowerCase("th-TH").includes(needle),
    ),
  );
}

export function findLegacyRoomTokens(storage: Storage): string[] {
  try {
    const tokens: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith("splitly-member:")) continue;
      const token = key.slice("splitly-member:".length);
      if (roomTokenPattern.test(token)) tokens.push(token);
    }
    return tokens;
  } catch {
    return [];
  }
}
