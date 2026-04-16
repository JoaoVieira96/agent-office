import Link from 'next/link'
import { Webhook } from 'lucide-react'

export default function HooksPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Hooks</h1>
      <p className="text-muted text-sm mb-8">
        Os hooks são eventos que disparam acções automáticas. Configura-os por agente.
      </p>

      {/* Explicação dos eventos */}
      <div className="grid gap-3 mb-10">
        {[
          { event: 'on_message_received',   desc: 'Dispara antes de o agente processar a mensagem.' },
          { event: 'on_message_sent',       desc: 'Dispara depois de o agente enviar a resposta.' },
          { event: 'on_task_complete',      desc: 'Dispara quando o agente marca uma tarefa como concluída.' },
          { event: 'on_error',              desc: 'Dispara quando ocorre um erro durante a execução.' },
          { event: 'on_conversation_start', desc: 'Dispara no início de cada nova conversa.' },
          { event: 'on_conversation_end',   desc: 'Dispara quando uma conversa é encerrada.' },
        ].map(({ event, desc }) => (
          <div key={event} className="flex gap-4 bg-panel border border-border rounded-xl px-4 py-3">
            <Webhook size={14} className="text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-mono text-white">{event}</p>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tipos de acção */}
      <h2 className="text-sm font-medium mb-3">Tipos de acção disponíveis</h2>
      <div className="grid grid-cols-3 gap-3 mb-10">
        {[
          { type: 'webhook', desc: 'Envia um HTTP POST para qualquer URL (Slack, Discord, Zapier…)' },
          { type: 'skill',   desc: 'Executa uma skill automaticamente como reacção ao evento' },
          { type: 'notify',  desc: 'Regista uma notificação nos logs do sistema' },
        ].map(({ type, desc }) => (
          <div key={type} className="bg-panel border border-border rounded-xl p-4">
            <p className="text-sm font-medium mb-1">{type}</p>
            <p className="text-xs text-muted">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-panel border border-border rounded-xl p-5 text-sm text-muted">
        Para configurar hooks, vai a{' '}
        <Link href="/agents" className="text-accent hover:underline">Agentes</Link>
        {' '}→ selecciona um agente → Hooks.
      </div>
    </div>
  )
}
