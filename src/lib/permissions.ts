import type { AppRole } from './roles';

export function isGlobalAdmin(role?: AppRole | null) {
  return role === 'global_admin';
}

export function isStaff(role?: AppRole | null) {
  return role === 'staff';
}

export function isStaffOrAdmin(role?: AppRole | null) {
  return isStaff(role) || isGlobalAdmin(role);
}

export function canViewAdminUI(role?: AppRole | null) {
  return isStaffOrAdmin(role);
}