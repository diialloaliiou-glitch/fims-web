export const ROLES = ["ADMIN_N1", "ADMIN_SITE", "RAF", "COMPTABLE", "USER"] as const;
export type Role = (typeof ROLES)[number];

// Hiérarchie : chaque rôle hérite des droits de tous les rôles listés,
// donc un ADMIN_N1 passe toujours les contrôles réservés à ADMIN_SITE/RAF.
const HIERARCHY: Record<Role, Role[]> = {
  ADMIN_N1: ["ADMIN_N1", "ADMIN_SITE", "RAF", "COMPTABLE", "USER"],
  ADMIN_SITE: ["ADMIN_SITE", "RAF", "COMPTABLE", "USER"],
  RAF: ["RAF", "COMPTABLE", "USER"],
  COMPTABLE: ["COMPTABLE", "USER"],
  USER: ["USER"],
};

export function hasRole(userRole: string | undefined | null, allowed: Role[]): boolean {
  if (!userRole) return false;
  const effective = HIERARCHY[userRole as Role];
  if (!effective) return false;
  return allowed.some((r) => effective.includes(r));
}

// Rôles qu'un utilisateur de ce rôle a le droit d'assigner à un AUTRE compte,
// en miroir exact des policies RLS "Creation de comptes par ADMIN_N1 ou ADMIN_SITE".
export function assignableRoles(userRole: string | undefined | null): Role[] {
  if (userRole === "ADMIN_N1") return ["ADMIN_N1", "ADMIN_SITE", "RAF", "COMPTABLE", "USER"];
  if (userRole === "ADMIN_SITE") return ["RAF", "COMPTABLE", "USER"];
  return [];
}
