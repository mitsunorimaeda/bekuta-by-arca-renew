export function canAccessRehab(staffType: string | null | undefined): boolean {
  return staffType === 'trainer' || staffType === 'both';
}
