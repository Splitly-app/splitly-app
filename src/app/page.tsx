import { RoomApp } from "@/features/rooms/room-app";

export default function Home() {
  const apiUrl = process.env.API_PROXY_TARGET
    ? "/api"
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082");
  return <RoomApp apiUrl={apiUrl} />;
}
