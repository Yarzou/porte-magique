'use client'

import { useEffect, useState } from 'react'
import { BatteryLow, BellRing, DoorOpen, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { VAPID_PUBLIC_KEY, deviceSubscription, disablePush, enablePush, pushSupport } from '@/lib/push'
import { usePassageData } from '@/components/passage/PassageData'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import Switch from '@/components/ui/Switch'
import Notice from '@/components/ui/Notice'

type DeviceState = 'chargement' | 'actif' | 'inactif' | 'installer' | 'indisponible'

/**
 * Notifications : ce téléphone (abonné ou non), puis ce que la personne veut
 * recevoir, sur tous ses appareils (colonnes de profiles).
 */
export default function NotificationSettings() {
  const { profile, updateProfile, showToast } = usePassageData()
  const [supabase] = useState(() => createClient())
  const [device, setDevice] = useState<DeviceState>('chargement')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const support = pushSupport()
    if (support === 'install') {
      void Promise.resolve().then(() => setDevice('installer'))
      return
    }
    if (support !== 'ok' || !VAPID_PUBLIC_KEY) {
      void Promise.resolve().then(() => setDevice('indisponible'))
      return
    }
    void deviceSubscription().then(sub => setDevice(sub && Notification.permission === 'granted' ? 'actif' : 'inactif'))
  }, [])

  const toggleDevice = async (on: boolean) => {
    setBusy('appareil')
    setError(null)
    try {
      if (on) await enablePush(supabase)
      else await disablePush(supabase)
      setDevice(on ? 'actif' : 'inactif')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opération impossible.')
    }
    setBusy(null)
  }

  const sendTest = async () => {
    setBusy('test')
    const res = await fetch('/api/notifications/test', { method: 'POST' }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as { sent?: number } | null
    setBusy(null)
    if (!res?.ok) showToast({ text: 'Envoi impossible. Réessayez.', tone: 'error' })
    else if (!json?.sent) showToast({ text: 'Aucun appareil à prévenir : activez d’abord les notifications ici.' })
    else showToast({ text: 'Notification envoyée.' })
  }

  const deviceSubtitle: Record<DeviceState, string> = {
    chargement: 'Chargement…',
    actif: 'Activées',
    inactif: 'Désactivées',
    installer: 'Installez d’abord l’appli sur l’écran d’accueil',
    indisponible: 'Ce navigateur ne sait pas les recevoir',
  }

  const pref = (key: 'notify_requests' | 'notify_neighbour' | 'notify_battery') => (
    <Switch
      label="Activer"
      checked={!!profile?.[key]}
      disabled={!profile}
      onChange={checked => void updateProfile({ [key]: checked })}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      <ListSection
        header="Notifications"
        footer="Sur iPhone, les notifications demandent l’appli installée sur l’écran d’accueil (Partager, puis « Sur l’écran d’accueil »)."
      >
        <ListRow
          leading={<IconTile className="bg-tile-bell"><Smartphone size={18} aria-hidden="true" /></IconTile>}
          title="Sur ce téléphone"
          subtitle={deviceSubtitle[device]}
          trailing={
            device === 'actif' || device === 'inactif' ? (
              <Switch label="Notifications sur ce téléphone" checked={device === 'actif'} disabled={busy !== null} onChange={toggleDevice} />
            ) : undefined
          }
        />
        <ListRow
          leading={<IconTile className="bg-tile-orange"><BellRing size={18} aria-hidden="true" /></IconTile>}
          title="Un enfant sonne"
          subtitle="Le bouton d’une des deux portes"
          trailing={pref('notify_requests')}
        />
        <ListRow
          leading={<IconTile className="bg-tile-green"><DoorOpen size={18} aria-hidden="true" /></IconTile>}
          title="Les voisins ouvrent ou ferment"
          trailing={pref('notify_neighbour')}
        />
        <ListRow
          leading={<IconTile className="bg-tile-red"><BatteryLow size={18} aria-hidden="true" /></IconTile>}
          title="Batterie faible"
          subtitle="Celle de votre porte"
          trailing={pref('notify_battery')}
        />
        {device === 'actif' && (
          <ListRow
            leading={<span className="w-[30px]" />}
            title={busy === 'test' ? 'Envoi…' : 'Envoyer une notification de test'}
            tone="accent"
            onClick={sendTest}
            disabled={busy !== null}
          />
        )}
      </ListSection>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
