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
import {
  MOCK_USERS,
  syncProfilesFromStorage,
  saveProfileToStorage,
} from "@/data/users";

type SafeUser = Omit<User, "password">;

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => { success: boolean; error?: string };
  register: (name: string, email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  updateOrganizationProfile: (profile: OrganizationProfile) => { success: boolean; error?: string };
  getAllUsers: () => SafeUser[];
  toggleUserActive: (userId: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore profiles from localStorage into MOCK_USERS
    syncProfilesFromStorage();

    const stored = localStorage.getItem("auth-user");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setAuthState({ user, isAuthenticated: true });
      } catch {
        localStorage.removeItem("auth-user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    (email: string, password: string) => {
      const found = MOCK_USERS.find(
        (u) => u.email === email && u.password === password
      );
      if (!found) return { success: false, error: "Credenciales invalidas" };
      if (found.isActive === false) return { success: false, error: "Tu cuenta ha sido desactivada" };
      const { password: _, ...safeUser } = found;
      localStorage.setItem("auth-user", JSON.stringify(safeUser));
      setAuthState({ user: safeUser, isAuthenticated: true });
      return { success: true };
    },
    []
  );

  const register = useCallback(
    (name: string, email: string, password: string) => {
      const exists = MOCK_USERS.find((u) => u.email === email);
      if (exists) return { success: false, error: "El email ya esta registrado" };
      const newUser: User = {
        id: `user-${Date.now()}`,
        name,
        email,
        password,
        isActive: true,
        createdTournamentIds: [],
      };
      MOCK_USERS.push(newUser);
      const { password: _, ...safeUser } = newUser;
      localStorage.setItem("auth-user", JSON.stringify(safeUser));
      setAuthState({ user: safeUser, isAuthenticated: true });
      return { success: true };
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("auth-user");
    setAuthState({ user: null, isAuthenticated: false });
  }, []);

  const updateOrganizationProfile = useCallback(
    (profile: OrganizationProfile) => {
      if (!authState.user) {
        return { success: false, error: "No hay usuario autenticado" };
      }

      const slugTaken = MOCK_USERS.some(
        (u) =>
          u.organizationProfile?.slug === profile.slug &&
          u.id !== authState.user?.id
      );

      if (slugTaken) {
        return { success: false, error: "Este slug ya esta en uso" };
      }

      const userIndex = MOCK_USERS.findIndex((u) => u.id === authState.user!.id);
      if (userIndex !== -1) {
        MOCK_USERS[userIndex] = {
          ...MOCK_USERS[userIndex],
          organizationProfile: profile,
        };

        const updatedUser = { ...authState.user, organizationProfile: profile };
        localStorage.setItem("auth-user", JSON.stringify(updatedUser));
        setAuthState({ user: updatedUser, isAuthenticated: true });

        // Persist to localStorage so it survives page reloads
        saveProfileToStorage(
          authState.user.id,
          authState.user.name,
          profile,
          MOCK_USERS[userIndex].createdTournamentIds
        );

        return { success: true };
      }

      return { success: false, error: "Error al actualizar perfil" };
    },
    [authState.user]
  );

  const getAllUsers = useCallback((): SafeUser[] => {
    return MOCK_USERS
      .filter((u) => u.role !== "admin")
      .map(({ password: _, ...safe }) => safe);
  }, []);

  const toggleUserActive = useCallback((userId: string) => {
    const idx = MOCK_USERS.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    MOCK_USERS[idx] = {
      ...MOCK_USERS[idx],
      isActive: MOCK_USERS[idx].isActive === false ? true : false,
    };
    // Force re-render by updating state
    setAuthState((prev) => ({ ...prev }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...authState, login, register, logout, updateOrganizationProfile, getAllUsers, toggleUserActive, isLoading }}
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
