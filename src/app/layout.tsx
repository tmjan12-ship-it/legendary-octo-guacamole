import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "個人事業 帳簿",
  description: "個人事業（青色申告65万円控除）のローカル会計ツール",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-slate-300 bg-white py-3 text-center text-xs text-slate-700 hidden sm:block">
          青色申告65万円控除対応 / 電子帳簿保存法対応 /
          <kbd className="font-mono bg-slate-100 border border-slate-300 rounded px-1 mx-1 text-[10px]">
            ?
          </kbd>
          でショートカット一覧
        </footer>
        <KeyboardShortcuts />
      </body>
    </html>
  );
}
