export interface UserPermissionOverride {
  Code: string;
  IsGranted: boolean;
}

// Role permissions form the default set; individual UserPermission rows
// override it per-code (IsGranted=true adds, IsGranted=false revokes).
export function computeEffectivePermissions(
  rolePermissionCodes: string[],
  overrides: UserPermissionOverride[],
): Set<string> {
  const effective = new Set(rolePermissionCodes);
  for (const override of overrides) {
    if (override.IsGranted) {
      effective.add(override.Code);
    } else {
      effective.delete(override.Code);
    }
  }
  return effective;
}
