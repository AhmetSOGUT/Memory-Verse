import type { AuthUser } from "../types";
import { api } from "./client";

export async function me(): Promise<AuthUser> {
  return (await api<{ user: AuthUser }>("GET", "/api/auth/me")).user;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  return (await api<{ user: AuthUser }>("POST", "/api/auth/login", { json: { username, password } })).user;
}

export function logout(): Promise<void> {
  return api<void>("POST", "/api/auth/logout");
}