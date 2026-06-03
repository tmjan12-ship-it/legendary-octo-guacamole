"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const password = formData.get("password") as string;
  const appPassword = process.env.APP_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!appPassword || !sessionSecret) {
    return { error: "サーバー設定エラー" };
  }
  if (password !== appPassword) {
    return { error: "パスワードが違います" };
  }

  const jar = await cookies();
  jar.set("pb_session", sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: "/",
  });

  redirect("/");
}
