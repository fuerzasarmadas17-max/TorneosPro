"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { User, AuthState, OrganizationProfile } from "@/types";
import { supabase } from "@/lib/supabase";
import { mapOrganizationProfile, mapSponsor } from "@/lib/db/mappers";

type SafeUser = Omit<User, "password">;

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateOrganizationProfile: (profile: OrganizationProfile) => Promise<{ success: boolean; error?: string }>;
  getAllUsers: () => Promise<SafeUser[]>;
  toggleUserActive: (userId: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadUserData(userId: string): Promise<SafeUser | null> {
  // Run all queries in parallel instead of sequentially
  const [userResult, profileResult, tournamentResult] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("organization_profiles").select("*, social_links(*), sponsors(*)").eq("user_id", userId).maybeSingle(),
    supabase.from("tournaments").select("id").eq("created_by", userId),
  ]);

  if (userResult.error || !userResult.data) return null;
  const userRow = userResult.data;

  const orgProfile = profileResult.data
    ? mapOrganizationProfile({
        ...profileResult.data,
        social_links: Array.isArray(profileResult.data.social_links)
          ? profileResult.data.social_links[0] ?? undefined
          : profileResult.data.social_links,
      })
    : undefined;

  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role ?? undefined,
    isActive: userRow.is_active,
    avatarUrl: userRow.avatar_url ?? undefined,
    createdTournamentIds: tournamentResult.data?.map((t: { id: string }) => t.id) ?? [],
    organizationProfile: orgProfile,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  // Track which user's full data we've already loaded to prevent overwrites
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION") &&
        session?.user
      ) {
        // TOKEN_REFRESHED: the JWT was renewed. Don't overwrite with basicUser,
        // but if full data wasn't loaded yet (e.g. INITIAL_SESSION had an expired
        // token), retry loading now with the fresh token.
        if (event === "TOKEN_REFRESHED") {
          if (loadedUserIdRef.current !== session.user.id) {
            try {
              const userData = await loadUserData(session.user.id);
              if (userData) {
                loadedUserIdRef.current = session.user.id;
                setAuthState({ user: userData, isAuthenticated: true });
              }
            } catch (err) {
              console.error("Failed to load user data after token refresh:", err);
            }
          }
          return;
        }

        // If we already loaded full data for this user (e.g. INITIAL_SESSION
        // fired twice), don't overwrite or re-fetch.
        if (loadedUserIdRef.current === session.user.id) {
          setIsLoading(false);
          return;
        }

        // Set basic user immediately for instant UI while full data loads
        const basicUser: SafeUser = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email || "",
          email: session.user.email || "",
          isActive: true,
          createdTournamentIds: [],
        };
        setAuthState({ user: basicUser, isAuthenticated: true });
        setIsLoading(false);

        // Load full user data in background (profile, tournaments, etc.)
        try {
          const userData = await loadUserData(session.user.id);
          if (userData) {
            loadedUserIdRef.current = session.user.id;
            setAuthState({ user: userData, isAuthenticated: true });
          }
        } catch (err) {
          console.error("Failed to load full user data:", err);
        }
      } else if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setAuthState({ user: null, isAuthenticated: false });
        setIsLoading(false);
      } else if (event === "INITIAL_SESSION" && !session) {
        // No session exists — user is not logged in
        setIsLoading(false);
      }
    });

    // Kick off session restoration (triggers INITIAL_SESSION event above)
    supabase.auth.getSession();

    // Safety: if auth never resolves (network hang, Supabase down), stop loading after 4s
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { success: false, error: "Credenciales invalidas" };

      // Check if user is active
      const { data: userRow } = await supabase
        .from("users")
        .select("is_active")
        .eq("id", data.user.id)
        .single();

      if (userRow?.is_active === false) {
        await supabase.auth.signOut();
        return { success: false, error: "Tu cuenta ha sido desactivada" };
      }

      // Don't call loadUserData here — onAuthStateChange (SIGNED_IN) already handles it.
      // Calling it twice doubles the network requests and slows down login.
      return { success: true };
    },
    []
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      // After confirming the email, Supabase redirects to this URL with the
      // session token in the URL hash. The supabase-js client picks it up
      // automatically, so landing on /dashboard gives the user a logged-in
      // session straight away instead of bouncing them to the Site URL
      // (which is the landing page).
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${appUrl}/dashboard`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          return { success: false, error: "El email ya esta registrado" };
        }
        return { success: false, error: error.message };
      }

      // The user row in public.users is created automatically by a DB trigger.
      // If email confirmation is enabled, the user must verify their email first.
      // Once confirmed, onAuthStateChange will fire and load their data.
      return { success: true, needsEmailConfirmation: true };
    },
    []
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    // Build the redirect URL the same way wompi-redirect.ts does — env override
    // for tunneled dev (ngrok), real origin in prod.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    // Don't reveal whether the email exists — same response either way.
    // Errors here are only surfaced for transport-level failures (network down,
    // misconfigured Supabase project), which the user can act on.
    if (error && !error.message.toLowerCase().includes("user")) {
      return { success: false, error: "No pudimos enviar el correo, intenta de nuevo" };
    }
    return { success: true };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    // Requires an active session — either a fresh recovery session from the
    // email link, or a regular logged-in user changing their password.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      // Prefer the structured `code` field (Supabase >= 2.x AuthApiError) — it's
      // stable across locales and SDK message tweaks. Fall back to message
      // substring matching for older errors that don't expose a code.
      const code = error.code ?? "";
      const msg = error.message.toLowerCase();
      if (code === "same_password" || msg.includes("different from the old")) {
        return { success: false, error: "La nueva contraseña debe ser distinta a la actual" };
      }
      if (code === "weak_password" || msg.includes("weak") || msg.includes("at least")) {
        return { success: false, error: "La contraseña es muy débil, probá una más larga o compleja" };
      }
      if (code === "over_request_rate_limit") {
        return { success: false, error: "Demasiados intentos, esperá un momento e intentá de nuevo" };
      }
      if (code === "auth_session_missing" || msg.includes("session")) {
        return { success: false, error: "El enlace expiró, pedí uno nuevo" };
      }
      return { success: false, error: "No pudimos actualizar la contraseña" };
    }
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    setAuthState({ user: null, isAuthenticated: false });
    try {
      await supabase.auth.signOut();
    } catch {
      // If signOut fails (network error, corrupted session), force-clear storage
      if (typeof window !== "undefined") {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("sb-")) localStorage.removeItem(key);
        });
      }
    }
  }, []);

  const updateOrganizationProfile = useCallback(
    async (profile: OrganizationProfile) => {
      if (!authState.user) {
        return { success: false, error: "No hay usuario autenticado" };
      }

      const userId = authState.user.id;

      // Check slug uniqueness
      const { data: slugCheck } = await supabase
        .from("organization_profiles")
        .select("id, user_id")
        .eq("slug", profile.slug)
        .neq("user_id", userId);

      if (slugCheck && slugCheck.length > 0) {
        return { success: false, error: "Este slug ya esta en uso" };
      }

      // Upsert organization_profiles
      const { data: existingProfile } = await supabase
        .from("organization_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      let profileId: string;

      if (existingProfile) {
        profileId = existingProfile.id;
        const { error } = await supabase
          .from("organization_profiles")
          .update({
            slug: profile.slug,
            organization_name: profile.organizationName,
            bio: profile.bio || null,
            logo_url: profile.logoUrl || null,
            location: profile.location || null,
            founded_year: profile.foundedYear || null,
            is_public: profile.isPublic,
          })
          .eq("id", profileId);

        if (error) return { success: false, error: "Error al actualizar perfil" };
      } else {
        const { data: newProfile, error } = await supabase
          .from("organization_profiles")
          .insert({
            user_id: userId,
            slug: profile.slug,
            organization_name: profile.organizationName,
            bio: profile.bio || null,
            logo_url: profile.logoUrl || null,
            location: profile.location || null,
            founded_year: profile.foundedYear || null,
            is_public: profile.isPublic,
          })
          .select("id")
          .single();

        if (error || !newProfile)
          return { success: false, error: "Error al crear perfil" };
        profileId = newProfile.id;
      }

      // Upsert social links
      if (profile.socialLinks) {
        await supabase.from("social_links").upsert(
          {
            organization_profile_id: profileId,
            website: profile.socialLinks.website || null,
            facebook: profile.socialLinks.facebook || null,
            instagram: profile.socialLinks.instagram || null,
            twitter: profile.socialLinks.twitter || null,
          },
          { onConflict: "organization_profile_id" }
        );
      }

      // Sync sponsors de la biblioteca (org) con UPSERT EN SU LUGAR.
      //
      // Antes esto hacía delete + reinsert, lo que regeneraba los ids en cada
      // guardado y rompía las referencias `library_sponsor_id` de los torneos.
      // Ahora: actualizamos las filas existentes por id (los ids se conservan),
      // insertamos las nuevas, y borramos solo las que el usuario quitó.
      //
      // Además, si cambió la IMAGEN de un logo de la biblioteca, la propagamos a
      // todos los usos de torneo que lo referencian (la URL de cada torneo NO se
      // toca — es independiente).
      if (profile.sponsors !== undefined) {
        const isUuid = (id: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const { data: existingRows } = await supabase
          .from("sponsors")
          .select("id, image_url")
          .eq("organization_profile_id", profileId);
        const existing = new Map(
          (existingRows ?? []).map((r) => [r.id as string, r.image_url as string])
        );

        const incoming = profile.sponsors ?? [];
        const keptIds = new Set<string>();

        for (const s of incoming) {
          if (isUuid(s.id) && existing.has(s.id)) {
            // Fila existente: update en su lugar (preserva id → refs válidas).
            keptIds.add(s.id);
            await supabase
              .from("sponsors")
              .update({
                image_url: s.imageUrl,
                link_url: s.linkUrl,
                name: s.name ?? "",
              })
              .eq("id", s.id);
            // Propagar SOLO la imagen a los usos de torneo que la referencian.
            if (existing.get(s.id) !== s.imageUrl) {
              await supabase
                .from("sponsors")
                .update({ image_url: s.imageUrl })
                .eq("library_sponsor_id", s.id);
            }
          } else {
            // Logo nuevo en la biblioteca.
            await supabase.from("sponsors").insert({
              image_url: s.imageUrl,
              link_url: s.linkUrl,
              name: s.name ?? "",
              organization_profile_id: profileId,
            });
          }
        }

        // Borrar los que el usuario quitó de la biblioteca. Los usos de torneo
        // que los referenciaban quedan con library_sponsor_id = NULL (ON DELETE
        // SET NULL) y conservan su última imagen — no se pierde nada.
        const toDelete = [...existing.keys()].filter((id) => !keptIds.has(id));
        if (toDelete.length > 0) {
          await supabase.from("sponsors").delete().in("id", toDelete);
        }
      }

      // Reload user data
      const updatedUser = await loadUserData(userId);
      if (updatedUser) {
        setAuthState({ user: updatedUser, isAuthenticated: true });
      }

      return { success: true };
    },
    [authState.user]
  );

  const getAllUsers = useCallback(async (): Promise<SafeUser[]> => {
    const { data, error } = await supabase
      .from("users")
      .select("*, organization_profiles(*, social_links(*), sponsors(*))")
      .neq("role", "admin");

    if (error || !data) return [];

    return data.map((row) => {
      const profileRow = Array.isArray(row.organization_profiles)
        ? row.organization_profiles[0]
        : row.organization_profiles;

      const orgProfile = profileRow
        ? mapOrganizationProfile({
            ...profileRow,
            social_links: Array.isArray(profileRow.social_links)
              ? profileRow.social_links[0] ?? undefined
              : profileRow.social_links,
          })
        : undefined;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role ?? undefined,
        isActive: row.is_active,
        avatarUrl: row.avatar_url ?? undefined,
        createdTournamentIds: [],
        organizationProfile: orgProfile,
      };
    });
  }, []);

  const toggleUserActive = useCallback(async (userId: string) => {
    // Get current state
    const { data: userRow } = await supabase
      .from("users")
      .select("is_active")
      .eq("id", userId)
      .single();

    if (!userRow) return;

    await supabase
      .from("users")
      .update({ is_active: !userRow.is_active })
      .eq("id", userId);

    // Force re-render
    setAuthState((prev) => ({ ...prev }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        requestPasswordReset,
        updatePassword,
        updateOrganizationProfile,
        getAllUsers,
        toggleUserActive,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
