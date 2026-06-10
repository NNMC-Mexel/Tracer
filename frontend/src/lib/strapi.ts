/**
 * Клиент для общения с бэкендом Strapi.
 * На этапе MVP JWT хранится в localStorage (клиентская авторизация).
 * Позже можно перенести на httpOnly-cookie.
 */

export const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";

const TOKEN_KEY = "tracer_jwt";
const USER_KEY = "tracer_user";

export interface StrapiUser {
  id: number;
  documentId?: string;
  username: string;
  email: string;
  blocked?: boolean;
  confirmed?: boolean;
  /** Направление аудита пользователя (Эпидемиология / Отдел качества). */
  program?: { id: number; name: string; slug: string } | null;
}

export interface AuthResult {
  jwt: string;
  user: StrapiUser;
}

/** Ошибка, пришедшая от Strapi (с человекочитаемым сообщением). */
export class StrapiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StrapiError";
    this.status = status;
  }
}

// --- Хранилище токена ---------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StrapiUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as StrapiUser) : null;
}

function setSession(auth: AuthResult): void {
  window.localStorage.setItem(TOKEN_KEY, auth.jwt);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

// --- Базовый запрос -----------------------------------------------------------

export async function strapiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${STRAPI_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.error?.message ?? "Произошла ошибка при обращении к серверу";
    throw new StrapiError(message, res.status);
  }
  return data as T;
}

// --- Авторизация --------------------------------------------------------------

/** Вход по логину/email и паролю (Strapi Users & Permissions). */
export async function login(
  identifier: string,
  password: string,
): Promise<AuthResult> {
  const auth = await strapiFetch<AuthResult>("/api/auth/local", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  setSession(auth);
  return auth;
}

/** Текущий пользователь по сохранённому токену (или null). */
export async function fetchMe(): Promise<StrapiUser | null> {
  if (!getToken()) return null;
  try {
    return await strapiFetch<StrapiUser>("/api/users/me?populate=program");
  } catch {
    return null;
  }
}
