"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, getStoredUser, logout, type StrapiUser } from "./strapi";

interface UseAuthState {
  user: StrapiUser | null;
  loading: boolean;
}

/**
 * Хук авторизации для клиентских страниц.
 * Если `requireAuth` — при отсутствии пользователя редиректит на /login.
 */
export function useAuth(requireAuth = true): UseAuthState & {
  signOut: () => void;
} {
  const router = useRouter();
  const [user, setUser] = useState<StrapiUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMe().then((me) => {
      if (!active) return;
      setUser(me);
      setLoading(false);
      if (requireAuth && !me) router.replace("/login");
    });
    return () => {
      active = false;
    };
  }, [requireAuth, router]);

  const signOut = () => {
    logout();
    setUser(null);
    router.replace("/login");
  };

  return { user, loading, signOut };
}
