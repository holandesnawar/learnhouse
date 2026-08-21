'use client'

import React from 'react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUserGroups } from '@services/usergroups/usergroups'
import {
  Automation,
  AutomationCatalog,
  ActionDef,
  createAutomation,
  deleteAutomation,
  getCatalog,
  listAutomations,
  testAutomation,
  updateAutomation,
} from '@services/automations/automations'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
  Zap,
} from 'lucide-react'

/**
 * Automatizaciones.
 *
 * Dos pestañas, y el orden importa:
 *
 * 1. **Lo que ya hace sola** — el mapa de lo que la escuela hace sin que nadie
 *    la toque. Es lo primero porque es la pregunta que se hace de verdad:
 *    "¿qué pasa exactamente cuando alguien se da de alta?". Sale del backend
 *    (`services/automations/builtin.py`), así que hay una sola versión de la
 *    verdad y no dos textos que se van separando.
 * 2. **Las mías** — las que se añaden desde aquí.
 *
 * Lo que NO hay todavía, y se dice en pantalla en vez de esconderlo: esperas
 * ("a los tres días manda esto"). Para eso hace falta algo que se despierte
 * solo cada día y la escuela aún no lo tiene.
 */
export default function WorkflowsPage() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const orgId = org?.id as number | undefined

  const [tab, setTab] = React.useState<'builtin' | 'mine'>('builtin')
  const [catalog, setCatalog] = React.useState<AutomationCatalog | null>(null)
  const [rows, setRows] = React.useState<Automation[]>([])
  const [groups, setGroups] = React.useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)

  const reload = React.useCallback(async () => {
    if (!orgId || !accessToken) return
    const [cat, list] = await Promise.all([
      getCatalog(orgId, accessToken),
      listAutomations(orgId, accessToken),
    ])
    setCatalog(cat)
    setRows(list)
    setLoading(false)
  }, [orgId, accessToken])

  React.useEffect(() => {
    reload()
  }, [reload])

  // Los grupos, para la acción "meterle en un grupo". `getUserGroups` no
  // devuelve la lista pelada, sino {success, data}.
  React.useEffect(() => {
    if (!orgId || !accessToken) return
    getUserGroups(orgId, accessToken)
      .then((res: any) => setGroups(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setGroups([]))
  }, [orgId, accessToken])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
        <Loader2 size={18} className="animate-spin" /> Cargando…
      </div>
    )
  }

  // No basta con que llegue algo: tiene que llegar con la forma que esperamos.
  // Si el servidor devolviera otra cosa, `catalog.builtin.map(...)` reventaría
  // la pantalla entera; así se ve un aviso y el panel sigue usable.
  const catalogOk =
    !!catalog &&
    Array.isArray(catalog.builtin) &&
    Array.isArray(catalog.triggers) &&
    Array.isArray(catalog.actions)

  if (!catalogOk) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center">
        <AlertTriangle size={22} className="text-[#025dc7] mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          No hemos podido cargar las automatizaciones. Recarga la página; si sigue igual, es que
          la parte del servidor todavía no está desplegada.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-2">
        <WorkflowIcon size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Automatizaciones</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-2xl">
        Lo que la escuela hace sola, y lo que quieras añadirle tú.
      </p>

      <div className="flex gap-1 border-b border-[#EEF3FB] mb-6">
        <TabButton active={tab === 'builtin'} onClick={() => setTab('builtin')}>
          Lo que ya hace sola
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          Las mías {rows.length > 0 && `(${rows.length})`}
        </TabButton>
      </div>

      {tab === 'builtin' ? (
        <BuiltinList catalog={catalog} />
      ) : (
        <MineList
          catalog={catalog}
          rows={rows}
          groups={groups}
          orgId={orgId as number}
          accessToken={accessToken}
          creating={creating}
          setCreating={setCreating}
          reload={reload}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? 'border-[#025dc7] text-[#025dc7]'
          : 'border-transparent text-gray-500 hover:text-[#025dc7]'
      }`}
    >
      {children}
    </button>
  )
}

/* ── Lo que la escuela hace sola ─────────────────────────────────────── */

function BuiltinList({ catalog }: { catalog: AutomationCatalog }) {
  const [open, setOpen] = React.useState<string | null>(catalog.builtin[0]?.id ?? null)

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-gray-500 mb-4">
        Esto no se configura: está escrito en el código y funciona siempre. Está aquí para que
        puedas verlo sin abrir nada.
      </p>

      {catalog.builtin.map((flow) => {
        const isOpen = open === flow.id
        return (
          <div key={flow.id} className="rounded-xl border border-[#DDE6F5] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : flow.id)}
              className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-[#F7FAFF] transition-colors"
            >
              <Zap size={17} className="text-[#4da3ff] shrink-0 mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-[#0a1656]">{flow.title}</span>
                <span className="block text-[13px] text-gray-500 mt-0.5">{flow.summary}</span>
              </span>
              <ChevronDown
                size={17}
                className={`shrink-0 mt-0.5 text-gray-400 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <ol className="px-4 pb-4 pt-1 space-y-2.5">
                {flow.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#F0F5FF] text-[#025dc7] text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] text-gray-800 leading-relaxed">
                        {step.text}
                      </span>
                      <code className="block text-[11px] text-gray-400 mt-0.5 break-all">
                        {step.where}
                      </code>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Las mías ────────────────────────────────────────────────────────── */

function MineList({
  catalog,
  rows,
  groups,
  orgId,
  accessToken,
  creating,
  setCreating,
  reload,
}: {
  catalog: AutomationCatalog
  rows: Automation[]
  groups: { id: number; name: string }[]
  orgId: number
  accessToken?: string
  creating: boolean
  setCreating: (v: boolean) => void
  reload: () => Promise<void>
}) {
  const labelOf = (list: { id: string; label: string }[], id: string) =>
    list.find((x) => x.id === id)?.label || id

  const toggle = async (row: Automation) => {
    try {
      await updateAutomation(orgId, row.id, { enabled: !row.enabled }, accessToken)
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    }
  }

  const remove = async (row: Automation) => {
    if (!window.confirm(`¿Borrar «${row.name}»? No se puede deshacer.`)) return
    try {
      await deleteAutomation(orgId, row.id, accessToken)
      toast.success('Borrada')
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar')
    }
  }

  const test = async (row: Automation) => {
    try {
      const res = await testAutomation(orgId, row.id, accessToken)
      if (res.ok) toast.success('Hecho. Va contra tu propia cuenta, así que compruébalo tú.')
      else toast.error(res.error || 'No funcionó')
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo probar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#F0F5FF] px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-[#4da3ff] shrink-0 mt-0.5" />
        <p className="text-[13px] text-[#0a1656] leading-relaxed">
          Todo lo que crees aquí ocurre <strong>en el momento</strong>. Todavía no se pueden
          programar esperas del tipo «a los tres días, manda esto»: para eso hace falta algo que
          se despierte solo cada día, y la escuela aún no lo tiene.
        </p>
      </div>

      {rows.length === 0 && !creating && (
        <div className="text-center py-10 px-6 rounded-xl border border-dashed border-[#DDE6F5]">
          <p className="text-sm text-gray-500 mb-4">
            Todavía no has añadido ninguna. Lo de la otra pestaña sigue funcionando igual.
          </p>
        </div>
      )}

      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-[#DDE6F5] bg-white px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-[#0a1656] truncate">{row.name}</p>
              <p className="text-[13px] text-gray-600 mt-0.5">
                {labelOf(catalog.triggers, row.trigger)} → {labelOf(catalog.actions, row.action)}
              </p>
              <p className="text-[12px] text-gray-400 mt-1">
                {row.run_count > 0
                  ? `Se ha ejecutado ${row.run_count} ${row.run_count === 1 ? 'vez' : 'veces'}`
                  : 'Todavía no se ha ejecutado'}
              </p>
              {row.last_error && (
                <p className="mt-1.5 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                  La última vez falló: {row.last_error}
                </p>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1">
              <button
                type="button"
                onClick={() => test(row)}
                title="Probarla conmigo"
                className="px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
              >
                Probar
              </button>
              <button
                type="button"
                onClick={() => toggle(row)}
                className={`px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                  row.enabled
                    ? 'text-[#0a1656] bg-[#F0F5FF] hover:bg-[#e3edff]'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {row.enabled ? 'Encendida' : 'Apagada'}
              </button>
              <button
                type="button"
                onClick={() => remove(row)}
                aria-label="Borrar"
                title="Borrar"
                className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {creating ? (
        <NewAutomation
          catalog={catalog}
          groups={groups}
          orgId={orgId}
          accessToken={accessToken}
          onDone={async () => {
            setCreating(false)
            await reload()
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold text-[14px] transition-colors"
        >
          <Plus size={16} /> Añadir una automatización
        </button>
      )}
    </div>
  )
}

function NewAutomation({
  catalog,
  groups,
  orgId,
  accessToken,
  onDone,
  onCancel,
}: {
  catalog: AutomationCatalog
  groups: { id: number; name: string }[]
  orgId: number
  accessToken?: string
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = React.useState('')
  const [trigger, setTrigger] = React.useState(catalog.triggers[0]?.id || '')
  const [action, setAction] = React.useState(catalog.actions[0]?.id || '')
  const [config, setConfig] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  const actionDef: ActionDef | undefined = catalog.actions.find((a) => a.id === action)
  const triggerDef = catalog.triggers.find((t) => t.id === trigger)

  const save = async () => {
    const missing = (actionDef?.fields || []).filter(
      (f) => f.required && !String(config[f.key] || '').trim()
    )
    if (missing.length) {
      toast.error(`Falta: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setSaving(true)
    try {
      await createAutomation(
        orgId,
        { name: name.trim() || 'Sin nombre', trigger, action, config, enabled: true },
        accessToken
      )
      toast.success('Creada. Pruébala antes de dejarla suelta.')
      await onDone()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: string) => config[key] || ''
  const setField = (key: string, value: string) =>
    setConfig((cur) => ({ ...cur, [key]: value }))

  const inputClass =
    'w-full bg-[#F0F5FF] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/40 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors'
  const labelClass = 'block text-[13px] font-semibold text-[#0a1656] mb-1.5'

  return (
    <div className="rounded-xl border border-[#4da3ff] bg-white px-4 py-4 space-y-4">
      <div>
        <label className={labelClass}>Cómo se llama</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bienvenida del profe"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Cuándo</label>
        <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={inputClass}>
          {catalog.triggers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {triggerDef && (
          <p className="text-[12.5px] text-gray-500 mt-1.5">{triggerDef.description}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Qué hace</label>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setConfig({})
          }}
          className={inputClass}
        >
          {catalog.actions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {actionDef && <p className="text-[12.5px] text-gray-500 mt-1.5">{actionDef.description}</p>}
      </div>

      {(actionDef?.fields || []).map((f) => (
        <div key={f.key}>
          <label className={labelClass}>
            {f.label}
            {f.required && <span className="text-rose-500"> *</span>}
          </label>
          {f.type === 'usergroup' ? (
            <select
              value={field(f.key)}
              onChange={(e) => setField(f.key, e.target.value)}
              className={inputClass}
            >
              <option value="">Elige un grupo…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' || f.type === 'richtext' ? (
            <textarea
              value={field(f.key)}
              onChange={(e) => setField(f.key, e.target.value)}
              rows={5}
              placeholder="Hola {nombre}…"
              className={`${inputClass} resize-y`}
            />
          ) : (
            <input
              value={field(f.key)}
              onChange={(e) => setField(f.key, e.target.value)}
              className={inputClass}
            />
          )}
        </div>
      ))}

      <p className="text-[12.5px] text-gray-500">
        En los textos puedes escribir <code className="text-[#025dc7]">{'{nombre}'}</code> y{' '}
        <code className="text-[#025dc7]">{'{email}'}</code>: se cambian por los de cada persona.
      </p>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold text-[14px] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {saving ? 'Guardando…' : 'Crear'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-[14px] font-semibold text-[#5A6480] hover:text-[#1D0084] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
