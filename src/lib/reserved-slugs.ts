const RESERVED_SLUGS = [
  "tournaments",
  "dashboard",
  "login",
  "register",
  "api",
  "admin",
  "_next",
  "static",
];

export function isSlugReserved(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
