'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Webhook, Plus, Trash2 } from 'lucide-react'

const API = (path: string) => fetch(`/api${path}`)
const API_JSON = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json())

const EVENTS = [
  { value: 'on_message_received',   label: 'Mensagem recebida' },
  { value: 'on_message_sent',       label: 'Resposta enviada' },
  { value: 'on_task_complete',      label: 'Tarefa concluída' },
  { value: 'on_error',              label: 'Erro' },
  { value: 'on_conversation_start', label: 'Conversa iniciada' },
  { value: 'on_conversation_end',   label: 'Conversa terminada' },
]

const ACTION_TYPES = [
  { value: 'webhook', label: 'Webhook (HTTP POST)' },
  { value: 'notify',  label: 'Notificação (log)' },
  { value: 'skill',   label: 'Executar Skill' },
]

export default function AgentHooksPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [hooks, setHooks]       = useState<any[]>([])
  const [agentName, setAgentName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', event: 'on_message_sent', action_type: 'webhook',
    config: { url: '', channel: 'console', skill_slug: '' },
  })

  useEffect(() => {
    API_JSON(`/agents/${params.id}`).then(a => setAgentName(a.name))
    refreshHooks()
  }, [params.id])

  const refreshHooks = () =>
    API_JSON(`/hooks/agent/${params.id}`).then(setHooks)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setConfig = (k: string, v: string) =>
    setForm(f => ({ ...f, config: { ...f.config, [k]: v } }))

  const create = async () => {
    await API_JSON('/hooks/', {
      method: 'POST',
      body: JSON.stringify({ ...form, agent_id: params.id }),
    })
    setShowForm(false)
    setForm({ name: '', event: 'on_message_sent', action_type: 'webhook', config: { url: '', channel: 'console', skill_slug: '' } })
    refreshHooks()
  }

  const toggle = async (hook: any) => {
    await API_JSON(`/hooks/${hook.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !hook.is_active }),
    })
    refreshHooks()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar hook?')) return
    await API(`/hooks/${id}`, { method: 'DELETE' })
    refreshHooks()
  }

  const eventLabel = (v: string) => EVENTS.find(e => e.value === v)?.label ?? v

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-muted hover:text-white mb-6 block">← Voltar</button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Hooks</h1>
          <p className="text-muted text-sm">{agentName}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm">
          <Plus size={14} /> Novo Hook
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="bg-panel border border-accent/30 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-medium">Novo Hook</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Nome</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="ex: Notifica no Slack" className="input-base w-full" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Evento</label>
              <select value={form.event} onChange={e => set('event', e.target.value)} className="input-base w-full">
                {EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Acção</label>
            <select value={form.action_type} onChange={e => set('action_type', e.target.value)} className="input-base w-full">
              {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {form.action_type === 'webhook' && (
            <div>
              <label className="text-xs text-muted block mb-1">URL do Webhook</label>
              <input value={form.config.url} onChange={e => setConfig('url', e.target.value)}
                placeholder="https://hooks.slack.com/services/..." className="input-base w-full" />
            </div>
          )}
          {form.action_type === 'skill' && (
            <div>
              <label className="text-xs text-muted block mb-1">Slug da Skill</label>
              <input value={form.config.skill_slug} onChange={e => setConfig('skill_slug', e.target.value)}
                placeholder="ex: web_search" className="input-base w-full" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={create} disabled={!form.name}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-dim text-sm disabled:opacity-40 transition-colors">
              Criar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-lg border border-border text-muted hover:text-white text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de hooks */}
      {hooks.length === 0 && !showForm ? (
        <div className="text-center py-16 text-muted text-sm">
          <Webhook size={28} className="mx-auto mb-3 opacity-30" />
          Nenhum hook configurado. Cria o primeiro para automatizar acções.
        </div>
      ) : (
        <div className="space-y-3">
          {hooks.map(hook => (
            <div key={hook.id}
              className="flex items-center gap-4 bg-panel border border-border rounded-xl px-4 py-3">
              <Webhook size={15} className={hook.is_active ? 'text-accent' : 'text-muted'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{hook.name}</p>
                <p className="text-xs text-muted">
                  {eventLabel(hook.event)} → {hook.action_type}
                  {hook.config?.url && <span className="ml-1 opacity-60 truncate">{hook.config.url}</span>}
                </p>
              </div>
              <button onClick={() => toggle(hook)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  hook.is_active
                    ? 'border-accent/40 text-accent hover:bg-accent/10'
                    : 'border-border text-muted hover:text-white'
                }`}>
                {hook.is_active ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => remove(hook.id)} className="text-muted hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
