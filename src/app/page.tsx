import { Button } from "@/components/ui/button";

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-primary">
        SPLITLY
      </p>
      <h1 className="text-4xl font-semibold leading-tight">
        พร้อมเริ่มต้น Splitly
      </h1>
      <p className="text-lg leading-relaxed text-slate-600">
        Next.js สำหรับหน้าเว็บ · Elysia สำหรับ API · Supabase สำหรับข้อมูลและยืนยันตัวตน
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={new URL("/healthz", apiUrl).href}>ตรวจสถานะ API</a>
        </Button>
        <Button asChild variant="outline">
          <a href="https://ui.shadcn.com/docs">เอกสาร shadcn/ui</a>
        </Button>
      </div>
      <p className="text-sm text-slate-500">
        นี่คือโครงเริ่มต้น ระบบธุรกิจ หน้าเข้าสู่ระบบ และการอัปโหลดไฟล์ยังต้องพัฒนาต่อ
      </p>
    </main>
  );
}
