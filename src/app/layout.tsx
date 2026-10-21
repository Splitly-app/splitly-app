import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const notoSansThai = localFont({
  src: "./fonts/NotoSansThai.ttf",
  variable: "--font-noto-thai",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Splitly",
  description: "Splitly ช่วยแบ่งค่าใช้จ่ายและหักกลบยอดโอนระหว่างเพื่อน",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <meta content="#ffffff" name="theme-color" />
        <Script id="theme-init" strategy="beforeInteractive">
          {
            "try{const t=localStorage.getItem('splitly-theme');const dark=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#0b0d12':'#ffffff')}catch{}"
          }
        </Script>
      </head>
      <body className={notoSansThai.variable}>{children}</body>
    </html>
  );
}
