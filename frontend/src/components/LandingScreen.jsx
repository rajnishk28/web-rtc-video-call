import { Camera, ArrowRight, Sparkles, Shield, Loader2 } from 'lucide-react'

const statusCopy = {
  idle: 'Ready when you are',
  connecting: 'Connecting…',
  waiting: 'Waiting for someone to join',
  connected: 'Connected',
  error: 'Something went wrong',
}

export function LandingScreen({
  status = 'idle',
  error,
  roomInput = '',
  onRoomInputChange,
  onJoin,
}) {
  const isError = Boolean(error) || status === 'error'
  const isBusy = status === 'connecting'

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!roomInput?.trim() || isBusy) return
    onJoin()
  }

  const generateRandomRoom = () => {
    const words = ['nova', 'apex', 'pulse', 'orbit', 'flux', 'echo']
    const pick = words[Math.floor(Math.random() * words.length)]
    const code = Math.floor(100 + Math.random() * 900)
    onRoomInputChange?.(`${pick}-${code}`)
  }

  return (
    <main className="relative flex min-h-[100svh] flex-col justify-between overflow-hidden bg-[#07090e] text-white antialiased selection:bg-[#456ff6]/30 selection:text-blue-200">
      {/* Crisp Ambient Spotlight & Subtle Grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#456ff6]/12 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_60%,transparent_100%)]" />
      </div>

      {/* Minimal Header */}
      <header className="relative z-10 mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <a
          href="#"
          className="group flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-b from-[#547bf7] to-[#3b63e6] shadow-[0_0_20px_rgba(69,111,246,0.35)] ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105">
            <Camera aria-hidden="true" className="h-4 w-4 text-white" />
          </span>
          <span>Connect</span>
        </a>

        {/* Clean Status Pill */}
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md transition-colors ${
            isError
              ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
              : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isError
                ? 'bg-rose-400'
                : isBusy
                  ? 'animate-ping bg-amber-400'
                  : 'bg-emerald-400'
            }`}
          />
          <span className="max-w-[200px] truncate sm:max-w-none">
            {error ?? statusCopy[status] ?? statusCopy.idle}
          </span>
        </div>
      </header>

      {/* Centered Hero Section */}
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-blue-200/90 shadow-sm backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6d8cff]" />
          Private, peer-to-peer video calls
        </div>

        {/* Crisp Display Headline */}
        <h1 className="mb-5 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-6xl md:text-[64px]">
          A little closer,{' '}
          <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            wherever you are.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mb-10 max-w-md text-balance text-sm leading-relaxed text-slate-400 sm:max-w-lg sm:text-base">
          Start an encrypted call with a room name and share it with one other
          person. Join seamlessly from your laptop or phone.
        </p>

        {/* Elevated Command-Bar Style Form */}
        <div className="w-full max-w-md sm:max-w-lg">
          <form
            onSubmit={handleSubmit}
            className="group relative flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#101622]/90 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/[0.04] backdrop-blur-xl transition-all focus-within:border-[#6d8cff]/50 focus-within:ring-[#6d8cff]/20 sm:flex-row sm:items-center"
          >
            <label htmlFor="room" className="sr-only">
              Room name
            </label>

            <div className="relative flex flex-1 items-center">
              <input
                id="room"
                name="room"
                type="text"
                value={roomInput}
                onChange={(event) => onRoomInputChange?.(event.target.value)}
                disabled={isBusy}
                className="w-full min-w-0 bg-transparent py-3 pl-3.5 pr-20 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50 sm:text-base"
                placeholder="Enter a room name…"
                autoComplete="off"
                spellCheck="false"
              />
              {/* Subtle Quick-Generate Button inside Input */}
              <button
                type="button"
                onClick={generateRandomRoom}
                title="Generate random room name"
                className="absolute right-2 inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white"
              >
                <Sparkles className="h-3 w-3 text-[#6d8cff]" />
                Random
              </button>
            </div>

            <button
              type="submit"
              disabled={!roomInput?.trim() || isBusy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#456ff6] px-5 py-3 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#567df8] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#6d8cff] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Joining…</span>
                </>
              ) : (
                <>
                  <span>Join call</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Subtle Trust Micro-copy */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-slate-400" />
              No account needed
            </span>
            <span aria-hidden="true" className="text-slate-700">
              •
            </span>
            <span>Camera and mic stay in your control</span>
          </div>
        </div>
      </section>

      {/* Ultra-Clean Minimal Footer */}
      <footer className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-center px-5 text-xs text-slate-600 sm:justify-between sm:px-8">
        <span>End-to-end encrypted via WebRTC</span>
        <span className="hidden sm:inline">1:1 Direct Peer Connection</span>
      </footer>
    </main>
  )
}