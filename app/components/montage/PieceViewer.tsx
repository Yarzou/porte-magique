'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { glassButton, GLASS } from '@/components/ui/glass'
import { formatBytes, stlUrl, type PrintPart } from '@/lib/montage'
import { cn } from '@/lib/utils'

interface Viewer {
  reset: () => void
  dispose: () => void
}

/**
 * La pièce en 3D, à faire tourner du doigt (un doigt pour tourner, deux pour
 * zoomer), posée comme sur le plateau de l'imprimante. three.js n'est chargé
 * qu'à l'ouverture : il ne pèse rien sur le reste de l'appli.
 */
export default function PieceViewer({ part, initialFile, onClose }: { part: PrintPart; initialFile: string; onClose: () => void }) {
  const [file, setFile] = useState(initialFile)
  const [size, setSize] = useState<string | null>(null)
  const [state, setState] = useState<'chargement' | 'pret' | 'erreur'>('chargement')
  const hostRef = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)
  const variant = part.variants.find(v => v.file === file) ?? part.variants[0]

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false

    async function start(el: HTMLDivElement) {
      const THREE = await import('three')
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
      const geometry = await new STLLoader().loadAsync(stlUrl(file))
      if (cancelled) {
        geometry.dispose()
        return
      }

      // L'impression est en z vers le haut ; three.js voit y vers le haut
      geometry.rotateX(-Math.PI / 2)
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      const dims = new THREE.Vector3()
      box.getSize(dims)
      setSize(`${Math.round(dims.x)} × ${Math.round(dims.z)} × ${Math.round(dims.y)} mm`)
      geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
      geometry.computeVertexNormals()

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(el.clientWidth, el.clientHeight)
      el.appendChild(renderer.domElement)
      renderer.domElement.style.touchAction = 'none'

      const scene = new THREE.Scene()
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bec7, 2.2))
      const sun = new THREE.DirectionalLight(0xffffff, 1.6)
      sun.position.set(1, 2, 1.5)
      scene.add(sun)

      // PETG blanc, et le plateau en dessous
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.62, metalness: 0 }))
      scene.add(mesh)
      const radius = Math.max(dims.x, dims.y, dims.z)
      const plate = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.9, 64),
        new THREE.MeshBasicMaterial({ color: 0x8e8e93, transparent: true, opacity: 0.12 }),
      )
      plate.rotation.x = -Math.PI / 2
      scene.add(plate)

      const camera = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 1, radius * 20)
      const target = new THREE.Vector3(0, dims.y / 2, 0)
      // Recul calculé pour que la sphère qui enveloppe la pièce tienne dans le champ le plus étroit
      // (horizontal sur un téléphone en portrait)
      const sphere = dims.length() / 2
      const home = () => {
        const vertical = THREE.MathUtils.degToRad(camera.fov)
        const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect)
        const distance = (sphere / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.2
        camera.position.copy(target).add(new THREE.Vector3(1, 0.8, 1.3).normalize().multiplyScalar(distance))
        camera.lookAt(target)
      }
      home()

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.target.copy(target)
      controls.enableDamping = true
      controls.enablePan = false
      controls.minDistance = sphere * 1.2
      controls.maxDistance = sphere * 12
      controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      controls.autoRotateSpeed = 1.6
      controls.addEventListener('start', () => {
        controls.autoRotate = false
      })

      let frame = 0
      const loop = () => {
        frame = requestAnimationFrame(loop)
        controls.update()
        renderer.render(scene, camera)
      }
      loop()

      const resize = new ResizeObserver(() => {
        camera.aspect = el.clientWidth / el.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(el.clientWidth, el.clientHeight)
      })
      resize.observe(el)

      viewer.current = {
        reset: () => {
          home()
          controls.target.copy(target)
          controls.update()
        },
        dispose: () => {
          cancelAnimationFrame(frame)
          resize.disconnect()
          controls.dispose()
          geometry.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        },
      }
      setState('pret')
    }

    start(host).catch(err => {
      console.error('[pièce 3D]', err)
      if (!cancelled) setState('erreur')
    })
    return () => {
      cancelled = true
      viewer.current?.dispose()
      viewer.current = null
    }
  }, [file])

  return (
    <div className="pt-safe fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="relative flex h-12 shrink-0 items-center px-4">
        <button type="button" onClick={onClose} aria-label="Fermer" className={cn(glassButton('round'), 'relative z-10')}>
          <X size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold">{part.title}</h1>
        <button type="button" onClick={() => viewer.current?.reset()} aria-label="Revenir à la vue de départ" className={cn(glassButton('round'), 'relative z-10 ml-auto')}>
          <RotateCcw size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <div ref={hostRef} className="relative min-h-0 flex-1" aria-label={`${part.title} en 3D, à tourner du doigt`} role="img">
        {state === 'chargement' && (
          <div className="absolute inset-0 flex items-center justify-center text-ink-muted">
            <LoaderCircle size={28} className="animate-spin" aria-hidden="true" />
          </div>
        )}
        {state === 'erreur' && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-subhead text-ink-muted">
            Impossible d’afficher la pièce. Vérifiez votre connexion.
          </p>
        )}
      </div>

      <div className="pb-safe shrink-0 px-2 pt-2">
        <div className={cn('flex flex-col gap-3 rounded-[30px] p-3.5', GLASS)}>
          {part.variants.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Variantes">
              {part.variants.map(v => (
                <button
                  key={v.file}
                  type="button"
                  onClick={() => {
                    if (v.file === file) return
                    setState('chargement')
                    setFile(v.file)
                  }}
                  aria-pressed={v.file === file}
                  className={cn(
                    'h-9 rounded-full px-3.5 text-subhead font-semibold',
                    v.file === file ? 'bg-accent-fill text-white' : 'bg-fill-soft text-ink',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-footnote text-ink">{variant.file}</p>
              <p className="text-footnote text-ink-muted">{size ? `${size} · ${formatBytes(variant.bytes)}` : formatBytes(variant.bytes)}</p>
            </div>
            <a
              href={stlUrl(variant.file)}
              download
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent-fill px-4 text-subhead font-semibold text-white"
            >
              <Download size={16} strokeWidth={2.4} aria-hidden="true" />
              STL
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
