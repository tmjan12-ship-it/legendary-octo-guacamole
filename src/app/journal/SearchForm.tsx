"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type State = {
  from: string;
  to: string;
  q: string;
  counterparty: string;
  amount: string;
  showVoid: boolean;
};

function readState(sp: URLSearchParams): State {
  return {
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    q: sp.get("q") ?? "",
    counterparty: sp.get("counterparty") ?? "",
    amount: sp.get("amount") ?? "",
    showVoid: sp.get("showVoid") === "1",
  };
}

export default function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State>(() => readState(params));
  const [pending, start] = useTransition();

  // パラメータ変更時はstateを同期（戻る/進むに追随）
  useEffect(() => {
    setState(readState(params));
  }, [params]);

  // stateからクエリ作成→URL置換（debounce 250ms）
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams();
      if (state.from) next.set("from", state.from);
      if (state.to) next.set("to", state.to);
      if (state.q) next.set("q", state.q);
      if (state.counterparty) next.set("counterparty", state.counterparty);
      if (state.amount) next.set("amount", state.amount);
      if (state.showVoid) next.set("showVoid", "1");
      const query = next.toString();
      const target = query ? `/journal?${query}` : "/journal";
      if (window.location.pathname + window.location.search === target) return;
      start(() => {
        router.replace(target, { scroll: false });
      });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.from,
    state.to,
    state.q,
    state.counterparty,
    state.amount,
    state.showVoid,
  ]);

  function update<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function clearAll() {
    setState({
      from: "",
      to: "",
      q: "",
      counterparty: "",
      amount: "",
      showVoid: false,
    });
  }

  return (
    <div className="bg-white border border-slate-300 rounded p-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
      <Field label="From">
        <input
          type="date"
          value={state.from}
          onChange={(e) => update("from", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1"
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          value={state.to}
          onChange={(e) => update("to", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1"
        />
      </Field>
      <Field label="摘要">
        <input
          type="text"
          value={state.q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="部分一致"
          className="w-full border border-slate-300 rounded px-2 py-1"
        />
      </Field>
      <Field label="取引先">
        <input
          type="text"
          value={state.counterparty}
          onChange={(e) => update("counterparty", e.target.value)}
          placeholder="部分一致"
          className="w-full border border-slate-300 rounded px-2 py-1"
        />
      </Field>
      <Field label="金額（一致）">
        <input
          type="number"
          value={state.amount}
          onChange={(e) => update("amount", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1"
        />
      </Field>
      <div className="flex items-end gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={state.showVoid}
            onChange={(e) => update("showVoid", e.target.checked)}
          />
          取消も表示
        </label>
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto text-xs text-slate-700 hover:underline"
        >
          クリア
        </button>
      </div>
      <div className="col-span-2 md:col-span-6 text-xs text-slate-700">
        {pending ? "検索中..." : "入力に応じて自動検索します"}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <div className="text-xs text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}
