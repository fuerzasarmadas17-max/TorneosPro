import { User, OrganizationProfile } from "@/types";

const PROFILES_KEY = "org-profiles";

export const MOCK_USERS: User[] = [
  {
    id: "user-1",
    name: "Juan Martinez",
    email: "juan@example.com",
    password: "password123",
    isActive: true,
    createdTournamentIds: ["t-1", "t-2"],
    organizationProfile: {
      slug: "fecor",
      organizationName: "FECOR",
      bio: "Federacion oficial de futbol. Organizamos torneos profesionales y amateur desde 2010.",
      socialLinks: {
        instagram: "@fecor",
        facebook: "fecor.official",
      },
      location: "San Jose, Costa Rica",
      foundedYear: 2010,
      isPublic: true,
    },
  },
  {
    id: "user-2",
    name: "Maria Lopez",
    email: "maria@example.com",
    password: "password123",
    isActive: true,
    createdTournamentIds: ["t-3", "t-4", "t-5"],
    organizationProfile: {
      slug: "liga-deportiva",
      organizationName: "Liga Deportiva Central",
      bio: "Promoviendo el deporte en nuestra comunidad. Organizamos torneos de multiples disciplinas.",
      socialLinks: {
        instagram: "@ligadeportiva",
        facebook: "ligadeportivacentral",
      },
      location: "Heredia, Costa Rica",
      isPublic: true,
    },
  },
  {
    id: "superadmin-1",
    name: "Admin MisTorneos",
    email: "admin@mistorneos.co",
    password: "admin123",
    role: "admin",
    isActive: true,
    createdTournamentIds: [],
  },
];

// --- Persistence helpers ---

interface StoredProfile {
  userId: string;
  userName: string;
  profile: OrganizationProfile;
  createdTournamentIds: string[];
}

function getStoredProfiles(): Record<string, StoredProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProfileToStorage(
  userId: string,
  userName: string,
  profile: OrganizationProfile,
  createdTournamentIds: string[]
) {
  const stored = getStoredProfiles();
  // Remove old slug entry if user changed their slug
  for (const [slug, entry] of Object.entries(stored)) {
    if (entry.userId === userId && slug !== profile.slug) {
      delete stored[slug];
    }
  }
  stored[profile.slug] = { userId, userName, profile, createdTournamentIds };
  localStorage.setItem(PROFILES_KEY, JSON.stringify(stored));
}

/**
 * Syncs MOCK_USERS with any profiles stored in localStorage.
 * Called once on app mount so that `getUserBySlug` works after reload.
 */
export function syncProfilesFromStorage() {
  const stored = getStoredProfiles();
  for (const entry of Object.values(stored)) {
    const idx = MOCK_USERS.findIndex((u) => u.id === entry.userId);
    if (idx !== -1) {
      MOCK_USERS[idx] = {
        ...MOCK_USERS[idx],
        organizationProfile: entry.profile,
      };
    } else {
      // User was registered at runtime (not in original mock data)
      MOCK_USERS.push({
        id: entry.userId,
        name: entry.userName,
        email: "",
        password: "",
        createdTournamentIds: entry.createdTournamentIds,
        organizationProfile: entry.profile,
      });
    }
  }
}

// --- Lookup helpers ---

export function getUserBySlug(slug: string): User | undefined {
  // First check in-memory (already synced from storage on mount)
  const fromMemory = MOCK_USERS.find(
    (u) =>
      u.organizationProfile?.slug === slug &&
      u.organizationProfile?.isPublic
  );
  if (fromMemory) return fromMemory;

  // Fallback: check localStorage directly (covers edge cases before sync)
  const stored = getStoredProfiles();
  const entry = stored[slug];
  if (entry && entry.profile.isPublic) {
    return {
      id: entry.userId,
      name: entry.userName,
      email: "",
      password: "",
      createdTournamentIds: entry.createdTournamentIds,
      organizationProfile: entry.profile,
    };
  }

  return undefined;
}

export function isSlugAvailable(slug: string, excludeUserId?: string): boolean {
  const taken = MOCK_USERS.some(
    (u) => u.organizationProfile?.slug === slug && u.id !== excludeUserId
  );
  if (taken) return false;

  const stored = getStoredProfiles();
  const entry = stored[slug];
  if (entry && entry.userId !== excludeUserId) return false;

  return true;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}
