/**
 * Types des lignes de la base (migration 001). Sans types générés, supabase-js
 * type une sélection imbriquée (`profiles ( display_name )`) comme un tableau,
 * alors qu'une relation « plusieurs vers un » renvoie un objet : on caste avec
 * `as unknown as`, comme dans Fridge.
 */

export type FamilyRole = 'admin' | 'membre'
export type DoorState = 'ouvert' | 'ferme'
export type LockState = 'ouvert' | 'ferme' | 'bloque'
export type EventKind = 'ouverture' | 'fermeture' | 'demande' | 'batterie_faible'

/** Appartenance lue par le layout serveur : le passage et la famille de la personne. */
export interface Membership {
  passageId: string
  passageName: string
  familyId: string
  familyName: string
  role: FamilyRole
}

export interface Passage {
  id: string
  name: string
  timezone: string
}

export interface Family {
  id: string
  passage_id: string
  name: string
  created_at: string
}

export interface Member {
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
  display_name: string
}

export interface Door {
  id: string
  passage_id: string
  family_id: string
  desired: DoorState
  desired_at: string
  desired_by: string | null
  open_until: string | null
  lock_state: LockState | null
  door_closed: boolean | null
  battery_mv: number | null
  last_seen_at: string | null
  angle_closed: number
  angle_open: number
  assembly_mode: boolean
  /**
   * Empreinte SHA-256 de la clé de la passerelle, ou null si aucune n'est
   * associée. Sans danger : appeler gateway_sync() exige la clé elle-même.
   */
  gateway_key_hash: string | null
  updated_at: string
  /** Ce que la porte doit faire maintenant (colonne calculée door_target) */
  door_target: DoorState
}

export interface Schedule {
  id: string
  door_id: string
  family_id: string
  /** Jours ISO : 1 = lundi … 7 = dimanche */
  weekdays: number[]
  /** « 14:00:00 » */
  starts_at: string
  ends_at: string
}

export interface PassageEvent {
  id: number
  passage_id: string
  door_id: string | null
  kind: EventKind
  actor: string | null
  detail: { minutes?: number }
  created_at: string
}

export interface Profile {
  id: string
  display_name: string
  notify_requests: boolean
  notify_neighbour: boolean
  notify_battery: boolean
}

/** Contenu d'une notification, lu par public/sw.js. */
export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

/** Ligne de invitation_preview() : ce qu'on montre avant l'inscription. */
export interface InvitationPreview {
  passage_name: string
  /** Famille rejointe, ou null pour l'invitation du voisin (qui crée la sienne) */
  family_name: string | null
  inviter_family: string | null
  invited_by: string | null
  is_neighbour: boolean
  expires_at: string
  is_valid: boolean
}
