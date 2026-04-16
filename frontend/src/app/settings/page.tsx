export default function SettingsPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Definições</h1>
      <p className="text-muted text-sm mb-8">Configuração do Agent Office</p>

      <div className="space-y-6">
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium mb-4">Variáveis de ambiente</h2>
          <p className="text-xs text-muted mb-3">
            As chaves de API são configuradas no ficheiro <code className="bg-surface border border-border px-1.5 py-0.5 rounded">.env</code> na raiz do projeto. Nunca as coloques directamente no código.
          </p>
          <div className="space-y-2">
            {[
              { key: 'ANTHROPIC_API_KEY', desc: 'Chave da API do Claude (obrigatória)', required: true },
              { key: 'OPENAI_API_KEY',    desc: 'Chave da API do OpenAI (opcional)' },
              { key: 'SECRET_KEY',        desc: 'Segredo para tokens internos' },
            ].map(({ key, desc, required }) => (
              <div key={key} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <code className="text-xs font-mono text-accent">{key}</code>
                {required && <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full">obrigatória</span>}
                <span className="text-xs text-muted ml-auto">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium mb-4">Serviços</h2>
          <div className="space-y-2 text-xs text-muted">
            {[
              { name: 'Frontend',   url: 'http://localhost:3000',        desc: 'Interface web' },
              { name: 'Backend',    url: 'http://localhost:8000',        desc: 'API FastAPI' },
              { name: 'API Docs',   url: 'http://localhost:8000/docs',   desc: 'Swagger UI' },
              { name: 'PostgreSQL', url: 'localhost:5432',               desc: 'Base de dados' },
              { name: 'Redis',      url: 'localhost:6379',               desc: 'Cache e filas' },
            ].map(({ name, url, desc }) => (
              <div key={name} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="font-medium text-white w-24">{name}</span>
                <code className="text-accent">{url}</code>
                <span className="ml-auto">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium mb-3">Comandos úteis</h2>
          <pre className="text-xs text-muted leading-loose">{`# Levantar tudo
docker compose up

# Ver logs em tempo real
docker compose logs -f backend

# Reiniciar apenas o backend (após adicionar skills)
docker compose restart backend

# Parar tudo
docker compose down

# Apagar dados (CUIDADO: apaga a base de dados)
docker compose down -v`}</pre>
        </section>
      </div>
    </div>
  )
}
