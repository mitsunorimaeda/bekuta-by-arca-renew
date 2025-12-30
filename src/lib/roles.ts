export const ROLES = {
  ATHLETE: 'athlete',
  STAFF: 'staff',
  PARENT: 'parent',
  GLOBAL_ADMIN: 'global_admin',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export const roleLabel: Record<AppRole, string> = {
  athlete: 'Athlete',
  staff: 'Staff',
  parent: 'Parent',
  global_admin: 'Global Admin',
};