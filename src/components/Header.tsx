"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "ダッシュボード" },
  { href: "/journal/new", label: "仕訳入力" },
  { href: "/journal", label: "仕訳一覧" },
  { href: "/reports/monthly", label: "月次" },
  { href: "/reports/journal-book", label: "仕訳帳" },
  { href: "/reports/general-ledger", label: "総勘定元帳" },
  { href: "/reports/final", label: "決算書" },
  { href: "/settings", label: "設定" },
];

export default function Header() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  // パス遷移したら自動で閉じる
  useEffect(() => {
    closeMenu();
  }, [pathname]);

  // 外側タップで閉じる
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        el.open = false;
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <header className="border-b border-slate-300 bg-white sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2.5 flex items-center gap-4">
        <Link
          href="/"
          className="font-semibold text-slate-900 whitespace-nowrap"
        >
          個人事業 帳簿
        </Link>

        {/* PC: 横並び（≥lg） */}
        <nav className="hidden lg:flex flex-1 gap-4 text-sm text-slate-700 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap hover:text-slate-900 ${
                isActive(item.href) ? "text-slate-900 font-medium" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* スマホ/タブレット: 仕訳ボタン + ハンバーガー */}
        <div className="flex-1 lg:hidden flex items-center justify-end gap-2">
          <Link
            href="/journal/new"
            className="bg-blue-600 text-white text-sm rounded px-3 py-2 hover:bg-blue-700"
          >
            + 仕訳
          </Link>
          <details ref={detailsRef} className="relative">
            <summary
              className="list-none w-11 h-11 flex items-center justify-center rounded hover:bg-slate-200 cursor-pointer select-none [&::-webkit-details-marker]:hidden"
              aria-label="メニュー"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </svg>
            </summary>
            <nav className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-300 rounded-lg shadow-lg z-40 py-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={`block px-4 py-3 text-sm border-b border-slate-100 last:border-b-0 ${
                    isActive(item.href)
                      ? "text-blue-700 font-medium bg-blue-50"
                      : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
