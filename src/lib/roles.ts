export const ROLES = {
  ATHLETE: 'athlete',
  STAFF: 'staff',
  GLOBAL_ADMIN: 'global_admin',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export const roleLabel: Record<AppRole, string> = {
  athlete: 'Athlete',
  staff: 'Staff',
  global_admin: 'Global Admin',
};