'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api, type Skill } from '@/lib/api'
import { Plus, X, Puzzle, Settings2, ChevronDown, ChevronUp } from 'lucide-react'

export default function AgentSkillsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [allSkills, setAllSkills]     = useState<Skill[]>([])
  const [agentSkills, setAgentSkills] = useState<any[]>([])
  const [agentName, setAgentName]     = useState('')
  const [busy, setBusy]               = useState('')
  // skillId → config values being edited before assigning
  const [pendingConfig, setPendingConfig] = useState<Record<string, Record<string, string>>>({})
  // which available skill has its config panel open
  const [configOpen, setConfigOpen] = useState<string | null>(null)

  useEffect(() => {
    api.agents.get(id).then(a => setAgentName(a.name))
    api.skills.list().then(setAllSkills)
    api.skills.forAgent(id).then(setAgentSkills)
  }, [id])

  const assignedIds = new Set(agentSkills.map(s => s.skill_id))

  const hasConfig = (skill: Skill) =>
    Object.keys(skill.config_schema?.properties ?? {}).length > 0

  const getConfig = (skillId: string, skill: Skill): Record<string, any> => {
    const props = skill.config_schema?.properties ?? {}
    const overrides = pendingConfig[skillId] ?? {}
    const result: Record<string, any> = {}
    for (const [key, def] of Object.entries(props)) {
      result[key] = overrides[key] !== undefined ? overrides[key] : (def.default ?? '')
    }
    return result
  }

  const setConfigValue = (skillId: string, key: string, value: string) => {
    setPendingConfig((prev: Record<string, Record<string, string>>) => ({
      ...prev,
      [skillId]: { ...(prev[skillId] ?? {}), [key]: value },
    }))
  }

  const assign = async (skill: Skill) => {
    setBusy(skill.id)
    const config = hasConfig(skill) ? getConfig(skill.id, skill) : {}
    await api.skills.assign(id, skill.id, config)
    const updated = await api.skills.forAgent(id)
    setAgentSkills(updated)
    setConfigOpen(null)
    setBusy('')
  }

  const remove = async (skillId: string) => {
    setBusy(skillId)
    await api.skills.remove(id, skillId)
    const updated = await api.skills.forAgent(id)
    setAgentSkills(updated)
    setBusy('')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-muted hover:text-white mb-6 block">← Voltar</button>

      <h1 className="text-2xl font-semibold tracking-tight mb-1">Skills do agente</h1>
      <p className="text-muted text-sm mb-8">{agentName}</p>

      {/* Skills activas */}
      <div className="mb-8">
        <h2 className="text-xs text-muted uppercase tracking-widest mb-3">Activas</h2>
        {agentSkills.length === 0 ? (
          <p className="text-muted text-sm">Nenhuma skill atribuída ainda.</p>
        ) : (
          <div className="space-y-2">
            {agentSkills.map(as => {
              const skill = allSkills.find(s => s.id === as.skill_id)
              const cfg = as.config && Object.keys(as.config).length > 0 ? as.config : null
              return (
                <div key={as.id} className="bg-panel border border-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Puzzle size={15} className="text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{skill?.name ?? as.skill_id}</p>
                      <p className="text-xs text-muted">{skill?.description}</p>
                    </div>
                    <button
                      onClick={() => remove(as.skill_id)}
                      disabled={busy === as.skill_id}
                      className="text-muted hover:text-red-400 transition-colors disabled:opacity-30"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {cfg && (
                    <div className="mt-2 ml-7 flex flex-wrap gap-2">
                      {Object.entries(cfg).map(([k, v]) => (
                        <span key={k} className="text-xs bg-border px-2 py-0.5 rounded-full text-muted">
                          {k}: <span className="text-white">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Skills disponíveis */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-widest mb-3">Disponíveis</h2>
        <div className="space-y-2">
          {allSkills
            .filter(s => s.is_enabled && !assignedIds.has(s.id))
            .map(skill => {
              const props = skill.config_schema?.properties ?? {}
              const isOpen = configOpen === skill.id
              return (
                <div key={skill.id} className="bg-panel border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 opacity-70 hover:opacity-100 transition-opacity">
                    <Puzzle size={15} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{skill.name}</p>
                      <p className="text-xs text-muted">{skill.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasConfig(skill) && (
                        <button
                          onClick={() => setConfigOpen(isOpen ? null : skill.id)}
                          className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-border"
                          title="Configurar"
                        >
                          <Settings2 size={12} />
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                      <button
                        onClick={() => hasConfig(skill) && !isOpen ? setConfigOpen(skill.id) : assign(skill)}
                        disabled={busy === skill.id}
                        className="flex items-center gap-1 text-xs text-accent hover:text-white transition-colors disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-accent/20"
                      >
                        <Plus size={12} /> Atribuir
                      </button>
                    </div>
                  </div>

                  {/* Config panel */}
                  {isOpen && hasConfig(skill) && (
                    <div className="border-t border-border px-4 py-4 bg-surface space-y-3">
                      <p className="text-xs text-muted flex items-center gap-1.5">
                        <Settings2 size={11} /> Configuração da skill
                      </p>
                      {Object.entries(props).map(([key, def]) => (
                        <div key={key}>
                          <label className="text-xs text-muted block mb-1">
                            {key}
                            {def.description && <span className="ml-1 text-muted/60">— {def.description}</span>}
                          </label>
                          <input
                            value={pendingConfig[skill.id]?.[key] ?? (def.default ?? '')}
                            onChange={e => setConfigValue(skill.id, key, e.target.value)}
                            className="input-base w-full text-sm"
                            placeholder={String(def.default ?? '')}
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => assign(skill)}
                        disabled={busy === skill.id}
                        className="mt-1 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-dim text-sm font-medium transition-colors disabled:opacity-40"
                      >
                        {busy === skill.id ? 'A atribuir…' : 'Confirmar e atribuir'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
