export interface JwtPayload {
  // User.Id — les permissions ne sont jamais figees dans le token, elles
  // sont toujours relues en base (voir PermissionGuard) a partir de ce sub.
  sub: string;
  employeeId: string;
  roleName: string;
}
