// Service worker de la porte magique (repris de Fridge).
//
// Volontairement minimal : aucun cache et aucun gestionnaire `fetch`. Il ne
// sert qu'aux notifications sur le téléphone (Web Push, voir lib/push.ts et
// lib/notify.ts) : une demande des enfants, le voisin qui ouvre sa porte.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

// Contenu envoyé par le serveur : { title, body, url, tag } (lib/notify.ts).
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Porte magique'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icon/192',
      data: { url: data.url || '/passage' },
    }),
  )
})

// Toucher la notification : on revient dans l'appli déjà ouverte, sinon on l'ouvre.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/passage', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(focused => (focused && 'navigate' in focused ? focused.navigate(url) : focused))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
