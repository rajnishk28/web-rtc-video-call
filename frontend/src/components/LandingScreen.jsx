import { Camera, Video } from 'lucide-react'

const statusCopy = {
  idle: 'Ready when you are',
  connecting: 'Connecting…',
  waiting: 'Waiting for someone to join',
  connected: 'Connected',
  error: 'Something went wrong',
}

export function LandingScreen({ status, error, roomInput, onRoomInputChange, onJoin }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onJoin()
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#0a0f18] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_15%,rgba(57,86,140,.18),transparent_42%),radial-gradient(ellipse_at_10%_90%,rgba(53,74,112,.12),transparent_45%)]" />
      <header className="relative mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <a href="#" className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-white">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#456ff6] shadow-lg shadow-blue-950/40">
            <Camera aria-hidden="true" className="h-4 w-4" />
          </span>
          Connect
        </a>
        <span className={`flex items-center gap-2 text-xs ${status === 'error' ? 'text-rose-300' : 'text-white/55'}`}>
          <span className={`h-2 w-2 rounded-full ${status === 'error' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          {error ?? statusCopy[status]}
        </span>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100svh-76px)] max-w-[1440px] items-center px-5 py-12 sm:px-8 lg:px-14">
        <div className="w-full max-w-[540px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-medium text-[#aebfff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6d8cff]" />
            Private, peer-to-peer video calls
          </div>
          <h1 className="mb-5 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-6xl">A little closer, wherever you are.</h1>
          <p className="mb-9 max-w-lg text-base leading-7 text-slate-400 sm:text-lg">Start a call with a room name and share it with one other person. Join from your laptop or phone.</p>
          <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-white/10 bg-[#121a26]/80 p-3 shadow-2xl shadow-black/20 sm:grid-cols-[1fr_auto] sm:p-3.5">
            <label htmlFor="room" className="sr-only">Room name</label>
            <input id="room" name="room" value={roomInput} onChange={(event) => onRoomInputChange(event.target.value)} className="min-w-0 rounded-xl border border-white/10 bg-[#0a101a] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-[#6d8cff]/70 focus:ring-2 focus:ring-[#6d8cff]/20" placeholder="Enter a room name" autoComplete="off" />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-[#456ff6] px-6 py-3.5 font-semibold text-white transition hover:bg-[#5c80ff] focus:outline-none focus:ring-2 focus:ring-[#9bb0ff] focus:ring-offset-2 focus:ring-offset-[#101722]">
              Join call <Video aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-500">No account needed. Your camera and microphone stay in your control.</p>
        </div>
      </section>
    </main>
  )
}
