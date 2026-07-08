export const PLATFORM_ADMIN_EMAIL = "pabloradamez10@gmail.com";

export function isPlatformAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
