// src/lib/roleUtils.ts
import type { AppRole } from './roles';

export function isGlobalAdmin(role?: AppRole | null) {
  return role === 'global_admin';
}

export function isStaff(role?: AppRole | null) {
  return role === 'staff';
}

export function isParent(role?: AppRole | null) {
  return role === 'parent';
}

export function isStaffOrAdmin(role?: AppRole | null) {
  return isStaff(role) || isGlobalAdmin(role);
}

/**
 * 管理UI（/admin 相当）を見せていいか
 * - 今は staff と global_admin
 * - もし parent にも一部見せたくなったら、ここだけ変えればOK
 */
export function canViewAdminUI(role?: AppRole | null) {
  return isStaffOrAdmin(role);
}