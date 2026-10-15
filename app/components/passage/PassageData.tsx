'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { usePassage } from '@/components/passage/PassageProvider'
import { reloadTo } from '@/lib/utils'
import type { Door, Family, Member, Passage, PassageEvent, Profile, Schedule } from '@/lib/types'

export interface Toast {
  id: number
  text: string
  tone?: 'error'
  undo?: () => void
}

export interface ScheduleInput {
  id?: string
  weekdays: number[]
  starts_at: string
  ends_at: string
}

type DoorSettings = Partial<Pick<Door, 'angle_closed' | 'angle_open' | 'assembly_mode'>>
type ProfilePatch = Partial<Omit<Profile, 'id'>>

export interface PassageDataValue {
  loading: boolean
  error: string | null
  passage: Passage | null
  families: Family[]
  members: Member[]
  doors: Door[]
  schedules: Schedule[]
  events: PassageEvent[]
  profile: Profile | null
  myFamily: Family | null
  otherFamily: Family | null
  myDoor: Door | null
  otherDoor: Door | null
  /** Horloge de l'écran, avancée toutes les 15 s (« hors ligne », « il y a 3 min ») */
  now: number
  commandDoor: (open: boolean, minutes?: number) => Promise<boolean>
  saveSchedule: (input: ScheduleInput) => Promise<boolean>
  deleteSchedule: (id: string) => Promise<void>
  updateDoorSettings: (patch: DoorSettings) => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<void>
  renameFamily: (name: string) => Promise<boolean>
  createInvitation: (neighbour: boolean) => Promise<string | null>
  newGatewayKey: () => Promise<string | null>
  removeMember: (userId: string) => Promise<void>
  refresh: () => Promise<void>
  toast: Toast | null
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: () => void
}

export const PassageDataContext = createContext<PassageDataValue | null>(null)

interface MemberRow {
  family_id: string
  user_id: string
  role: Member['role']
  joined_at: string
  profiles: { display_name: string } | null
}

/** Colonnes d'une porte qui changent ce qu'elle doit faire (colonne calculée door_target). */
const TARGET_INPUTS = ['desired', 'desired_at', 'open_until', 'assembly_mode'] as const

/**
 * Données du passage, chargées une fois pour tous les écrans (comme
 * HouseholdData dans Fridge) : familles, membres, portes, horaires, journal.
 * Suivies en direct (Realtime), relues au retour au premier plan, et la
 * cible des portes est recalculée chaque minute (début ou fin d'un horaire).
 *
 * Les ordres passent par /api/porte, qui prévient l'autre famille ; le reste
 * s'écrit directement, sous le RLS.
 */
export function PassageDataProvider({ children }: { children: ReactNode }) {
  const { membership, userId } = usePassage()
  const { passageId, familyId } = membership
  const [supabase] = useState(() => createClient())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [passage, setPassage] = useState<Passage | null>(null)
  const [families, setFamilies] = useState<Family[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [doors, setDoors] = useState<Door[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [events, setEvents] = useState<PassageEvent[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState<Toast | null>(null)
  const toastId = useRef(0)
  // Dernières portes connues, lues par les abonnements Realtime sans s'y réabonner
  const doorsRef = useRef<Door[]>([])
  useEffect(() => {
    doorsRef.current = doors
  }, [doors])

  const showToast = useCallback((t: Omit<Toast, 'id'>) => {
    toastId.current += 1
    setToast({ ...t, id: toastId.current })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  const load = useCallback(async () => {
    const [passageRes, familiesRes, membersRes, doorsRes, schedulesRes, eventsRes, profileRes] = await Promise.all([
      supabase.from('passages').select('id, name, timezone').eq('id', passageId).single(),
      supabase.from('families').select('id, passage_id, name, created_at').eq('passage_id', passageId).order('created_at'),
      supabase.from('family_members').select('family_id, user_id, role, joined_at, profiles ( display_name )').order('joined_at'),
      supabase.from('doors').select('*, door_target').eq('passage_id', passageId),
      supabase.from('schedules').select('id, door_id, family_id, weekdays, starts_at, ends_at').order('starts_at'),
      supabase.from('events').select('*').eq('passage_id', passageId).order('created_at', { ascending: false }).limit(40),
      supabase.from('profiles').select('id, display_name, notify_requests, notify_neighbour, notify_battery').eq('id', userId).single(),
    ])
    const failed = [passageRes, familiesRes, membersRes, doorsRes, schedulesRes, eventsRes].find(r => r.error)
    if (failed?.error) {
      console.error('[passage] chargement impossible :', failed.error.code, failed.error.message)
      setError('Impossible de charger le passage. Vérifiez votre connexion.')
      setLoading(false)
      return
    }
    const familyRows = (familiesRes.data ?? []) as Family[]
    const familyIds = new Set(familyRows.map(f => f.id))
    const doorRows = (doorsRes.data ?? []) as Door[]
    const doorIds = new Set(doorRows.map(d => d.id))
    setPassage(passageRes.data as Passage)
    setFamilies(familyRows)
    setMembers(
      ((membersRes.data ?? []) as unknown as MemberRow[])
        .filter(m => familyIds.has(m.family_id))
        .map(m => ({ ...m, display_name: m.profiles?.display_name ?? '' })),
    )
    setDoors(doorRows)
    setSchedules(((schedulesRes.data ?? []) as Schedule[]).filter(s => doorIds.has(s.door_id)))
    setEvents((eventsRes.data ?? []) as PassageEvent[])
    if (profileRes.data) setProfile(profileRes.data as Profile)
    setError(null)
    setNow(Date.now())
    setLoading(false)
  }, [supabase, passageId, userId])

  /** Relit seulement la cible des portes (début ou fin d'horaire, ordre reçu). */
  const refreshTargets = useCallback(async () => {
    const { data } = await supabase.from('doors').select('id, door_target').eq('passage_id', passageId)
    if (!data) return
    const targets = new Map(data.map(d => [d.id as string, d.door_target as Door['door_target']]))
    setDoors(list => list.map(d => (targets.has(d.id) ? { ...d, door_target: targets.get(d.id)! } : d)))
  }, [supabase, passageId])

  // Premier chargement, hors du corps de l'effet (règle react-hooks/set-state-in-effect)
  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  // Direct : portes, journal, horaires
  useEffect(() => {
    const onDoor = (payload: RealtimePostgresChangesPayload<Door>) => {
      if (payload.eventType !== 'UPDATE') {
        void load()
        return
      }
      const next = payload.new
      const previous = doorsRef.current.find(d => d.id === next.id)
      setDoors(list => list.map(d => (d.id === next.id ? { ...d, ...next, door_target: d.door_target } : d)))
      if (!previous || TARGET_INPUTS.some(k => previous[k] !== next[k])) void refreshTargets()
    }
    const onEvent = (payload: RealtimePostgresChangesPayload<PassageEvent>) => {
      if (payload.eventType !== 'INSERT') return
      const row = payload.new
      setEvents(list => (list.some(e => e.id === row.id) ? list : [row, ...list].slice(0, 40)))
    }
    const onSchedule = () => {
      void supabase
        .from('schedules')
        .select('id, door_id, family_id, weekdays, starts_at, ends_at')
        .order('starts_at')
        .then(({ data }) => {
          if (!data) return
          const doorIds = new Set(doorsRef.current.map(d => d.id))
          setSchedules((data as Schedule[]).filter(s => doorIds.has(s.door_id)))
        })
      void refreshTargets()
    }

    const channel = supabase
      .channel(`passage:${passageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doors', filter: `passage_id=eq.${passageId}` }, onDoor)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `passage_id=eq.${passageId}` }, onEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, onSchedule)
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, passageId, load, refreshTargets])

  // Horloge de l'écran, cibles recalculées chaque minute, tout relu au retour au premier plan
  useEffect(() => {
    let ticks = 0
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setNow(Date.now())
      ticks += 1
      if (ticks % 4 === 0) void refreshTargets()
    }, 15_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, refreshTargets])

  const myFamily = families.find(f => f.id === familyId) ?? null
  const otherFamily = families.find(f => f.id !== familyId) ?? null
  const myDoor = doors.find(d => d.family_id === familyId) ?? null
  const otherDoor = doors.find(d => d.family_id !== familyId) ?? null

  const commandDoor = useCallback(
    async (open: boolean, minutes?: number) => {
      if (!myDoor) return false
      const before = myDoor
      const nowIso = new Date().toISOString()
      setDoors(list =>
        list.map(d =>
          d.id === before.id
            ? {
                ...d,
                desired: open ? 'ouvert' : 'ferme',
                desired_at: nowIso,
                desired_by: userId,
                open_until: open && minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null,
                door_target: d.assembly_mode ? 'ferme' : open ? 'ouvert' : 'ferme',
              }
            : d,
        ),
      )
      try {
        const res = await fetch('/api/porte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doorId: before.id, open, minutes: minutes ?? null }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { target?: Door['door_target'] }
        if (json.target) setDoors(list => list.map(d => (d.id === before.id ? { ...d, door_target: json.target! } : d)))
        return true
      } catch {
        setDoors(list => list.map(d => (d.id === before.id ? before : d)))
        showToast({ text: 'L’ordre n’est pas parti. Vérifiez votre connexion.', tone: 'error' })
        return false
      }
    },
    [myDoor, userId, showToast],
  )

  const saveSchedule = useCallback(
    async (input: ScheduleInput) => {
      if (!myDoor) return false
      const row = { weekdays: input.weekdays, starts_at: input.starts_at, ends_at: input.ends_at }
      const { data, error } = input.id
        ? await supabase.from('schedules').update(row).eq('id', input.id).select('id, door_id, family_id, weekdays, starts_at, ends_at').single()
        : await supabase
            .from('schedules')
            .insert({ ...row, door_id: myDoor.id, family_id: myDoor.family_id })
            .select('id, door_id, family_id, weekdays, starts_at, ends_at')
            .single()
      if (error || !data) {
        showToast({ text: 'Horaire non enregistré. Réessayez.', tone: 'error' })
        return false
      }
      const saved = data as Schedule
      setSchedules(list => [...list.filter(s => s.id !== saved.id), saved].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
      void refreshTargets()
      return true
    },
    [supabase, myDoor, showToast, refreshTargets],
  )

  const deleteSchedule = useCallback(
    async (id: string) => {
      const before = schedules
      const removed = schedules.find(s => s.id === id)
      setSchedules(list => list.filter(s => s.id !== id))
      const { error } = await supabase.from('schedules').delete().eq('id', id)
      if (error) {
        setSchedules(before)
        showToast({ text: 'Suppression impossible. Réessayez.', tone: 'error' })
        return
      }
      void refreshTargets()
      if (removed) {
        showToast({
          text: 'Horaire supprimé',
          undo: () => {
            void saveSchedule({ weekdays: removed.weekdays, starts_at: removed.starts_at, ends_at: removed.ends_at })
          },
        })
      }
    },
    [supabase, schedules, showToast, refreshTargets, saveSchedule],
  )

  const updateDoorSettings = useCallback(
    async (patch: DoorSettings) => {
      if (!myDoor) return
      const before = myDoor
      setDoors(list => list.map(d => (d.id === before.id ? { ...d, ...patch } : d)))
      const { error } = await supabase.from('doors').update(patch).eq('id', before.id)
      if (error) {
        setDoors(list => list.map(d => (d.id === before.id ? before : d)))
        showToast({ text: 'Réglage non enregistré. Réessayez.', tone: 'error' })
        return
      }
      if ('assembly_mode' in patch) void refreshTargets()
    },
    [supabase, myDoor, showToast, refreshTargets],
  )

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!profile) return
      const before = profile
      setProfile({ ...profile, ...patch })
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) {
        setProfile(before)
        showToast({ text: 'Réglage non enregistré. Réessayez.', tone: 'error' })
        return
      }
      if (patch.display_name) {
        setMembers(list => list.map(m => (m.user_id === userId ? { ...m, display_name: patch.display_name! } : m)))
      }
    },
    [supabase, profile, userId, showToast],
  )

  const renameFamily = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      const { error } = await supabase.from('families').update({ name: trimmed }).eq('id', familyId)
      if (error) {
        showToast({ text: 'Nom non enregistré. Réessayez.', tone: 'error' })
        return false
      }
      setFamilies(list => list.map(f => (f.id === familyId ? { ...f, name: trimmed } : f)))
      return true
    },
    [supabase, familyId, showToast],
  )

  const createInvitation = useCallback(
    async (neighbour: boolean) => {
      const { data, error } = await supabase.rpc('create_invitation', { p_neighbour: neighbour })
      if (error || !data) {
        showToast({ text: 'Lien non créé. Réessayez.', tone: 'error' })
        return null
      }
      return `${window.location.origin}/invitation/${data as string}`
    },
    [supabase, showToast],
  )

  const newGatewayKey = useCallback(async () => {
    if (!myDoor) return null
    const { data, error } = await supabase.rpc('new_gateway_key', { p_door: myDoor.id })
    if (error || !data) {
      showToast({ text: 'Clé non créée. Réessayez.', tone: 'error' })
      return null
    }
    setDoors(list => list.map(d => (d.id === myDoor.id ? { ...d, gateway_key_hash: 'nouvelle' } : d)))
    return data as string
  }, [supabase, myDoor, showToast])

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', memberId)
      if (error) {
        showToast({ text: 'Opération impossible. Réessayez.', tone: 'error' })
        return
      }
      if (memberId === userId) {
        reloadTo('/bienvenue')
        return
      }
      setMembers(list => list.filter(m => !(m.family_id === familyId && m.user_id === memberId)))
    },
    [supabase, familyId, userId, showToast],
  )

  const value = useMemo<PassageDataValue>(
    () => ({
      loading,
      error,
      passage,
      families,
      members,
      doors,
      schedules,
      events,
      profile,
      myFamily,
      otherFamily,
      myDoor,
      otherDoor,
      now,
      commandDoor,
      saveSchedule,
      deleteSchedule,
      updateDoorSettings,
      updateProfile,
      renameFamily,
      createInvitation,
      newGatewayKey,
      removeMember,
      refresh: load,
      toast,
      showToast,
      dismissToast,
    }),
    [
      loading, error, passage, families, members, doors, schedules, events, profile, myFamily, otherFamily, myDoor,
      otherDoor, now, commandDoor, saveSchedule, deleteSchedule, updateDoorSettings, updateProfile, renameFamily,
      createInvitation, newGatewayKey, removeMember, load, toast, showToast, dismissToast,
    ],
  )

  return <PassageDataContext.Provider value={value}>{children}</PassageDataContext.Provider>
}

export function usePassageData(): PassageDataValue {
  const value = useContext(PassageDataContext)
  if (!value) throw new Error('usePassageData() hors de <PassageDataProvider>')
  return value
}
