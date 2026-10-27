import { Camera, CameraOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import { VideoTile } from './VideoTile'

const statusCopy = {
  connecting: 'Connecting…',
  waiting: 'Waiting for someone to join',
  connected: 'Connected',
  error: 'Something went wrong',
}

function ControlButton({ label, icon: Icon, onClick, pressed = false, danger = false }) {
  const color = danger
    ? 'bg-[#f04444] shadow-[0_8px_24px_rgba(240,68,68,.28)] hover:bg-[#ff5a55]'
    : pressed
      ? 'bg-[#344054] ring-1 ring-white/15'
      : 'bg-[#202938] hover:bg-[#2d394b]'

  return (
    <button className="group flex min-w-[58px] flex-col items-center gap-1.5 text-white" type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} title={label}>
      <span className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-95 sm:h-[54px] sm:w-[54px] ${color}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-medium text-white/75 sm:text-xs">{label}</span>
    </button>
  )
}

export function CallScreen({ status, error, roomId, localStream, remoteStream, muted, cameraOff, remoteMuted, remoteCameraOff, leaveRoom, toggleMute, toggleCamera }) {
  return (
    <main className="flex h-[100svh] flex-col overflow-hidden bg-[#0a101a] text-white">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:h-[68px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#456ff6] shadow-lg shadow-blue-950/40">
            <Camera aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-wide">Connect</span>
          {roomId && <span className="hidden truncate border-l border-white/10 pl-3 text-xs text-white/45 sm:block">Room · {roomId}</span>}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-white/65 sm:gap-2.5 sm:text-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${status === 'connected' ? 'bg-emerald-400' : 'animate-pulse bg-amber-300'}`} />
          <span className="max-w-[55vw] truncate" aria-live="polite">{error ?? statusCopy[status]}</span>
        </div>
      </header>

      <section aria-label="Video call" className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-2 px-2 pb-2 sm:gap-3 sm:px-4 sm:pb-3 md:grid-cols-2 md:grid-rows-1 md:px-6 lg:px-8">
        <VideoTile stream={localStream} muted mirror label={cameraOff ? 'You · camera off' : 'You'} placeholder="Starting your camera…" videoDisabled={cameraOff} audioMuted={muted} />
        <VideoTile stream={remoteStream} label="Them" placeholder="Waiting for the other person to join…" videoDisabled={remoteCameraOff} videoDisabledLabel="Their camera is off" audioMuted={remoteMuted} />
      </section>

      <nav className="flex h-[88px] shrink-0 items-center justify-center gap-3 border-t border-white/[.06] bg-[#0b111c] px-3 pb-[max(.35rem,env(safe-area-inset-bottom))] sm:h-[100px] sm:gap-5" aria-label="Call controls">
        <ControlButton label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} pressed={muted} icon={muted ? MicOff : Mic} />
        <ControlButton label={cameraOff ? 'Start video' : 'Turn off camera'} onClick={toggleCamera} pressed={cameraOff} icon={cameraOff ? CameraOff : Camera} />
        <ControlButton label="Leave call" onClick={leaveRoom} danger icon={PhoneOff} />
      </nav>
    </main>
  )
}
