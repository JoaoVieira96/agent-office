'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Agent } from '@/lib/api'
import { Trash2 } from 'lucide-react'

const MODELS = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai:    ['gpt-4o', 'gpt-4o-mini'],
  ollama:    ['llama3.2', 'mistral', 'codestral'],
}

const AVATARS = ['🤖', '🧠', '💡', '🔍', '⚙️', '🛠️', '📊', '✍️', '🐍', '🚀']

export default function EditAgentPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<Partial<Agent>>({})

  useEffect(() => {
    api.agents.get(params.id).then(a => setForm({
      name:          a.name,
      description:   a.description,
      avatar:        a.avatar,
      system_prompt: a.system_prompt,
      llm_provider:  a.llm_provider,
      llm_model:     a.llm_model,
      temperature:   a.temperature,
    }))
  }, [params.id])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await api.agents.update(params.id, form)
      router.push('/agents')
    } catch { alert('Erro ao guardar'); setSaving(false) }
  }

  const remove = async () => {
    if (!confirm('Arquivar este agente?')) return
    setDeleting(true)
    await api.agents.delete(params.id)
    router.push('/agents')
  }

  if (!form.name) return (
    <div className="p-8 text-muted text-sm">A carregar…</div>
  )

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editar Agente</h1>
          <p className="text-muted text-sm mt-1">{form.name}</p>
        </div>
        <button
          onClick={remove}
          disabled={deleting}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20 transition-colors text-sm"
        >
          <Trash2 size={14} /> Arquivar
        </button>
      </div>

      <div className="space-y-6">
        {/* Avatar */}
        <div>
          <label className="text-xs text-muted block mb-2">Avatar</label>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map(e => (
              <button key={e} onClick={() => set('avatar', e)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors
                  ${form.avatar === e ? 'border-accent bg-accent/20' : 'border-border hover:border-border/80 bg-panel'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nome" required>
          <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} className="input-base w-full" />
        </Field>

        <Field label="Descrição">
          <input value={form.description ?? ''} onChange={e => set('description', e.target.value)} className="input-base w-full" />
        </Field>

        <Field label="System Prompt" required>
          <textarea value={form.system_prompt ?? ''} onChange={e => set('system_prompt', e.target.value)}
            rows={8} className="input-base w-full resize-none" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Provider">
            <select value={form.llm_provider ?? 'anthropic'}
              onChange={e => { set('llm_provider', e.target.value); set('llm_model', MODELS[e.target.value as keyof typeof MODELS][0]) }}
              className="input-base w-full">
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama</option>
            </select>
          </Field>
          <Field label="Modelo">
            <select value={form.llm_model ?? ''} onChange={e => set('llm_model', e.target.value)} className="input-base w-full">
              {MODELS[(form.llm_provider ?? 'anthropic') as keyof typeof MODELS].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={`Temperatura: ${((form.temperature ?? 70) / 100).toFixed(2)}`}>
          <input type="range" min={0} max={100} value={form.temperature ?? 70}
            onChange={e => set('temperature', Number(e.target.value))} className="w-full accent-accent" />
        </Field>

        <div className="flex gap-3 pt-2">
          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-dim transition-colors text-sm font-medium disabled:opacity-40">
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
          <button onClick={() => router.back()}
            className="px-5 py-2 rounded-lg border border-border hover:bg-border transition-colors text-sm text-muted">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, required }: any) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1.5">
        {label}{required && <span className="text-accent ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
