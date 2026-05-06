/**
 * Default permissions matrix per role.
 * These reflect the current hardcoded behavior and serve as the base.
 * DB overrides (role_permissions table) take precedence for non-admin roles.
 * Admin always has full access — cannot be overridden.
 */

export type PermissionLevel = "can_read" | "can_read_detail" | "can_edit" | "can_delete";

export type ProcessPermissionLevel = "can_read" | "can_detail" | "can_comment" | "can_edit" | "can_version";

export type AppModule =
  | "processus"
  | "cartographie"
  | "bpmn"
  | "evaluation_processus"
  | "documents"
  | "indicateurs"
  | "risques"
  | "incidents"
  | "enjeux_contexte"
  | "politique_qualite"
  | "revue_direction"
  | "revue_direction_iso"
  | "competences"
  | "satisfaction_client"
  | "fournisseurs"
  | "audits"
  | "non_conformites"
  | "actions"
  | "acteurs"
  | "utilisateurs"
  | "groupes_acteurs"
  | "journal"
  | "notifications"
  | "gestion_documentaire";

export const ALL_MODULES: AppModule[] = [
  "processus",
  "cartographie",
  "bpmn",
  "evaluation_processus",
  "documents",
  "indicateurs",
  "risques",
  "incidents",
  "enjeux_contexte",
  "politique_qualite",
  "revue_direction",
  "revue_direction_iso",
  "competences",
  "satisfaction_client",
  "fournisseurs",
  "audits",
  "non_conformites",
  "actions",
  "acteurs",
  "utilisateurs",
  "groupes_acteurs",
  "journal",
  "notifications",
  "gestion_documentaire",
];

export const MODULE_LABELS: Record<AppModule, string> = {
  processus: "Processus",
  cartographie: "Cartographie",
  bpmn: "BPMN",
  evaluation_processus: "Évaluation processus",
  documents: "Documents",
  indicateurs: "Indicateurs",
  risques: "Risques & Opportunités",
  incidents: "Incidents",
  enjeux_contexte: "Enjeux du contexte",
  politique_qualite: "Politique qualité",
  revue_direction: "Revue de processus",
  revue_direction_iso: "Revue de direction (§9.3)",
  competences: "Compétences",
  satisfaction_client: "Satisfaction client",
  fournisseurs: "Fournisseurs",
  audits: "Audits",
  non_conformites: "Non-conformités",
  actions: "Plans d'action",
  acteurs: "Acteurs",
  utilisateurs: "Utilisateurs",
  groupes_acteurs: "Groupes d'acteurs",
  journal: "Journal d'activité",
  notifications: "Notifications",
  gestion_documentaire: "Config. documentaire",
};

export type AppRole = "super_admin" | "admin" | "rmq" | "dg" | "responsable_processus" | "consultant" | "auditeur" | "acteur";

export const ALL_ROLES: AppRole[] = ["super_admin", "admin", "rmq", "dg", "responsable_processus", "consultant", "auditeur", "acteur"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  rmq: "RMQ",
  dg: "DG (Direction Générale)",
  responsable_processus: "Resp. processus",
  consultant: "Consultant",
  auditeur: "Auditeur",
  acteur: "Acteur",
};

export interface ModulePermissions {
  can_read: boolean;
  can_read_detail: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const ALL_TRUE: ModulePermissions = { can_read: true, can_read_detail: true, can_edit: true, can_delete: true };
const READ_ONLY: ModulePermissions = { can_read: true, can_read_detail: false, can_edit: false, can_delete: false };
const READ_DETAIL: ModulePermissions = { can_read: true, can_read_detail: true, can_edit: false, can_delete: false };
const READ_EDIT: ModulePermissions = { can_read: true, can_read_detail: true, can_edit: true, can_delete: false };
const NONE: ModulePermissions = { can_read: false, can_read_detail: false, can_edit: false, can_delete: false };

/**
 * Default permissions per role per module.
 * Admin is always full — handled separately in hasPermission().
 */
export const DEFAULT_PERMISSIONS: Record<Exclude<AppRole, "admin" | "super_admin">, Record<AppModule, ModulePermissions>> = {
  rmq: {
    processus: ALL_TRUE,
    cartographie: ALL_TRUE,
    bpmn: ALL_TRUE,
    evaluation_processus: ALL_TRUE,
    documents: ALL_TRUE,
    indicateurs: ALL_TRUE,
    risques: ALL_TRUE,
    incidents: ALL_TRUE,
    enjeux_contexte: ALL_TRUE,
    politique_qualite: ALL_TRUE,
    revue_direction: ALL_TRUE,
    revue_direction_iso: ALL_TRUE,
    competences: ALL_TRUE,
    satisfaction_client: ALL_TRUE,
    fournisseurs: ALL_TRUE,
    audits: ALL_TRUE,
    non_conformites: ALL_TRUE,
    actions: ALL_TRUE,
    acteurs: ALL_TRUE,
    utilisateurs: ALL_TRUE,
    groupes_acteurs: ALL_TRUE,
    journal: READ_DETAIL,
    notifications: ALL_TRUE,
    gestion_documentaire: ALL_TRUE,
  },
  dg: {
    processus: READ_DETAIL,
    cartographie: READ_DETAIL,
    bpmn: READ_DETAIL,
    evaluation_processus: READ_DETAIL,
    documents: READ_DETAIL,
    indicateurs: READ_DETAIL,
    risques: READ_DETAIL,
    incidents: READ_DETAIL,
    enjeux_contexte: READ_DETAIL,
    politique_qualite: READ_DETAIL,
    revue_direction: READ_DETAIL,
    revue_direction_iso: READ_DETAIL,
    competences: READ_DETAIL,
    satisfaction_client: READ_DETAIL,
    fournisseurs: READ_DETAIL,
    audits: READ_DETAIL,
    non_conformites: READ_DETAIL,
    actions: READ_DETAIL,
    acteurs: READ_DETAIL,
    utilisateurs: READ_DETAIL,
    groupes_acteurs: READ_DETAIL,
    journal: READ_DETAIL,
    notifications: READ_ONLY,
    gestion_documentaire: READ_DETAIL,
  },
  responsable_processus: {
    processus: READ_EDIT,
    cartographie: READ_DETAIL,
    bpmn: READ_EDIT,
    evaluation_processus: READ_EDIT,
    documents: READ_EDIT,
    indicateurs: READ_EDIT,
    risques: READ_EDIT,
    incidents: READ_EDIT,
    enjeux_contexte: READ_EDIT,
    politique_qualite: READ_DETAIL,
    revue_direction: READ_DETAIL,
    revue_direction_iso: READ_DETAIL,
    competences: READ_DETAIL,
    satisfaction_client: READ_DETAIL,
    fournisseurs: READ_DETAIL,
    audits: READ_DETAIL,
    non_conformites: READ_EDIT,
    actions: READ_EDIT,
    acteurs: READ_DETAIL,
    utilisateurs: NONE,
    groupes_acteurs: NONE,
    journal: READ_ONLY,
    notifications: NONE,
    gestion_documentaire: NONE,
  },
  consultant: {
    processus: READ_EDIT,
    cartographie: READ_DETAIL,
    bpmn: READ_EDIT,
    evaluation_processus: READ_EDIT,
    documents: READ_DETAIL,
    indicateurs: READ_DETAIL,
    risques: READ_DETAIL,
    incidents: READ_DETAIL,
    enjeux_contexte: READ_EDIT,
    politique_qualite: READ_DETAIL,
    revue_direction: READ_DETAIL,
    revue_direction_iso: READ_DETAIL,
    competences: READ_DETAIL,
    satisfaction_client: READ_DETAIL,
    fournisseurs: READ_DETAIL,
    audits: READ_DETAIL,
    non_conformites: READ_DETAIL,
    actions: READ_DETAIL,
    acteurs: READ_DETAIL,
    utilisateurs: NONE,
    groupes_acteurs: NONE,
    journal: NONE,
    notifications: NONE,
    gestion_documentaire: NONE,
  },
  auditeur: {
    processus: READ_DETAIL,
    cartographie: READ_DETAIL,
    bpmn: READ_DETAIL,
    evaluation_processus: READ_DETAIL,
    documents: READ_DETAIL,
    indicateurs: READ_DETAIL,
    risques: READ_DETAIL,
    incidents: READ_DETAIL,
    enjeux_contexte: READ_DETAIL,
    politique_qualite: READ_DETAIL,
    revue_direction: READ_DETAIL,
    revue_direction_iso: READ_DETAIL,
    competences: READ_DETAIL,
    satisfaction_client: READ_DETAIL,
    fournisseurs: READ_DETAIL,
    audits: ALL_TRUE,
    non_conformites: READ_EDIT,
    actions: READ_EDIT,
    acteurs: READ_DETAIL,
    utilisateurs: NONE,
    groupes_acteurs: NONE,
    journal: READ_ONLY,
    notifications: NONE,
    gestion_documentaire: NONE,
  },
  acteur: {
    processus: READ_ONLY,
    cartographie: READ_ONLY,
    bpmn: READ_ONLY,
    evaluation_processus: NONE,
    documents: NONE,
    indicateurs: READ_ONLY,
    risques: READ_ONLY,
    incidents: NONE,
    enjeux_contexte: READ_ONLY,
    politique_qualite: READ_ONLY,
    revue_direction: NONE,
    revue_direction_iso: NONE,
    competences: NONE,
    satisfaction_client: NONE,
    fournisseurs: NONE,
    audits: NONE,
    non_conformites: NONE,
    actions: NONE,
    acteurs: READ_ONLY,
    utilisateurs: NONE,
    groupes_acteurs: NONE,
    journal: NONE,
    notifications: NONE,
    gestion_documentaire: NONE,
  },
};

/**
 * Custom role permissions loaded from DB.
 * Key = custom_role_id:module
 */
export type CustomRolePermissions = Record<string, ModulePermissions>;

/**
 * Get effective permission for a set of roles on a module.
 * Admin always returns true.
 * For standard roles, DB overrides take precedence; otherwise defaults apply.
 * Custom roles use their DB permissions directly.
 * Multiple roles: most permissive wins (OR logic).
 */
export function getEffectivePermission(
  roles: AppRole[],
  module: AppModule,
  level: PermissionLevel,
  dbOverrides: Record<string, ModulePermissions>, // key = "role:module"
  customRoleIds: string[] = [],
  customRolePerms: CustomRolePermissions = {}
): boolean {
  if (roles.includes("super_admin") || roles.includes("admin")) return true;

  // Check standard roles
  const standardMatch = roles.some((role) => {
    if (role === "admin") return true;
    const overrideKey = `${role}:${module}`;
    const override = dbOverrides[overrideKey];
    if (override) return override[level];
    const defaults = DEFAULT_PERMISSIONS[role as Exclude<AppRole, "admin" | "super_admin">];
    if (!defaults) return false;
    return defaults[module]?.[level] ?? false;
  });

  if (standardMatch) return true;

  // Check custom roles
  return customRoleIds.some((crId) => {
    const key = `${crId}:${module}`;
    return customRolePerms[key]?.[level] ?? false;
  });
}
