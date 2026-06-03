"use client";

import { useState, useTransition } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await login(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-xl shadow p-8 w-full max-w-sm space-y-6">
        <h1 className="text-xl font-bold text-center">個人事業 帳簿</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            name="password"
            placeholder="パスワード"
            autoFocus
            required
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "確認中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
