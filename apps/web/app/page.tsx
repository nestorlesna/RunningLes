import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-xl font-bold text-brand">RunningLes</span>
        <Link
          href="/login"
          className="bg-brand text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-400 transition-colors"
        >
          Entrar
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 text-center px-6 py-24 gap-6">
        <div className="text-7xl">🏃</div>
        <h1 className="text-5xl font-extrabold tracking-tight">
          Cada kilómetro,{' '}
          <span className="text-brand">registrado.</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl">
          RunningLes rastrea tus carreras y caminatas con GPS en segundo plano,
          guarda todo localmente y sincroniza cuando tenés internet.
        </p>
        <div className="flex gap-4 mt-4">
          <Link
            href="/login"
            className="bg-brand text-black font-bold px-6 py-3 rounded-xl hover:bg-green-400 transition-colors"
          >
            Ver mis sesiones
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-8 pb-20 max-w-5xl mx-auto w-full">
        <FeatureCard
          icon="📍"
          title="GPS preciso"
          description="Tracking en segundo plano con precisión BestForNavigation. Funciona con la pantalla apagada."
        />
        <FeatureCard
          icon="📴"
          title="Offline primero"
          description="Tus datos se guardan en el dispositivo. Se sincronizan automáticamente cuando hay conexión."
        />
        <FeatureCard
          icon="📊"
          title="Estadísticas"
          description="Distancia, ritmo, velocidad, duración y mapa de ruta para cada sesión."
        />
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm pb-8">
        RunningLes — hecho por Nestor
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3">
      <span className="text-3xl">{icon}</span>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}
