"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
    supabase.from("organization_profiles").select("*, social_links(*), sponsors(*)").eq("user_id", userId).single(),
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
        // Set authenticated IMMEDIATELY with basic info from the session token.
        // This prevents the "logged out" flash on refresh and makes login instant.
        // Full user data (profile, tournaments) loads in the background.
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
            setAuthState({ user: userData, isAuthenticated: true });
          }
          // If loadUserData fails, user stays authenticated with basic info
        } catch (err) {
          console.error("Failed to load full user data:", err);
        }
      } else if (event === "SIGNED_OUT") {
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
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

      // Sync sponsors: delete existing and re-insert
      if (profile.sponsors !== undefined) {
        await supabase
          .from("sponsors")
          .delete()
          .eq("organization_profile_id", profileId);

        if (profile.sponsors && profile.sponsors.length > 0) {
          await supabase.from("sponsors").insert(
            profile.sponsors.map((s) => ({
              image_url: s.imageUrl,
              link_url: s.linkUrl,
              organization_profile_id: profileId,
            }))
          );
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
