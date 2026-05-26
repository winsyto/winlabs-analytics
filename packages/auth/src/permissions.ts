/**
 * Sistema de permisos de wlA
 *
 * Implementación inicial con defaults estáticos por rol.
 * TODO (futuro): cargar overrides desde la DB para permitir
 *   configuración de permisos por tenant en la administración de roles.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Role = "admin" | "analyst" | "viewer";

export type Resource = "users" | "roles" | "settings" | "reports";

export type Action = "read" | "create" | "edit" | "delete";

// ---------------------------------------------------------------------------
// Defaults por rol
// ---------------------------------------------------------------------------

/**
 * Permisos por defecto para cada rol.
 * Estos valores aplican salvo que el tenant defina overrides en la DB.
 *
 * Matriz inicial:
 *   admin   → acceso total a todos los recursos
 *   analyst → puede leer todo, crear/editar reports; no toca users/roles/settings
 *   viewer  → solo lectura de users y reports; sin acceso a roles ni settings
 */
const DEFAULT_PERMISSIONS: Record<Role, Record<Resource, ReadonlyArray<Action>>> = {
  admin: {
    users:    ["read", "create", "edit", "delete"],
    roles:    ["read", "create", "edit", "delete"],
    settings: ["read", "edit"],
    reports:  ["read", "create", "edit", "delete"],
  },
  analyst: {
    users:    ["read"],
    roles:    ["read"],
    settings: ["read"],
    reports:  ["read", "create", "edit"],
  },
  viewer: {
    users:    ["read"],
    roles:    [],
    settings: [],
    reports:  ["read"],
  },
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ForbiddenError extends Error {
  public readonly role: Role;
  public readonly action: Action;
  public readonly resource: Resource;

  constructor(role: Role, action: Action, resource: Resource) {
    super(
      `El rol "${role}" no tiene permiso para "${action}" en "${resource}"`
    );
    this.name = "ForbiddenError";
    this.role = role;
    this.action = action;
    this.resource = resource;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna true si el rol puede realizar la acción sobre el recurso.
 * Usa los defaults estáticos (no consulta la DB).
 */
export function canPerform(
  role: Role,
  action: Action,
  resource: Resource
): boolean {
  return (DEFAULT_PERMISSIONS[role][resource] as Action[]).includes(action);
}

/**
 * Lanza ForbiddenError si el rol no puede editar el recurso.
 */
export function assertCanEdit(role: Role, resource: Resource): void {
  if (!canPerform(role, "edit", resource)) {
    throw new ForbiddenError(role, "edit", resource);
  }
}

/**
 * Lanza ForbiddenError si el rol no puede realizar la acción sobre el recurso.
 * Más general que assertCanEdit — usar cuando la acción no es necesariamente "edit".
 *
 * @example
 * assertCan("analyst", "delete", "reports"); // lanza ForbiddenError
 * assertCan("admin",   "delete", "reports"); // ok
 */
export function assertCan(role: Role, action: Action, resource: Resource): void {
  if (!canPerform(role, action, resource)) {
    throw new ForbiddenError(role, action, resource);
  }
}
