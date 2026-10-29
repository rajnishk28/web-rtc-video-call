import { Camera, CameraOff, Mic, MicOff, RefreshCw, ScreenShare, ScreenShareOff } from 'lucide-react'
import { VideoTile } from './VideoTile'

const statusCopy = {
  connecting: 'Connecting…',
  waiting: 'Waiting for someone to join',
  connected: 'Connected',
  error: 'Something went wrong',
}

function HangUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M3.7 8.1c4.9-3.1 11.7-3.1 16.6 0 .7.4 1 1.2.8 2l-.7 2.5c-.2.8-1 1.3-1.8 1.1l-3.1-.7c-.8-.2-1.3-.9-1.2-1.7l.2-1.2a9.3 9.3 0 0 0-5 0l.2 1.2c.1.8-.4 1.5-1.2 1.7l-3.1.7c-.8.2-1.6-.3-1.8-1.1l-.7-2.5c-.2-.8.1-1.6.8-2Z" />
    </svg>
  )
}

function ControlButton({ label, icon: Icon, onClick, pressed = false, danger = false, disabled = false, className = '' }) {
  const color = danger
    ? 'bg-[#f04444] shadow-[0_8px_24px_rgba(240,68,68,.28)] hover:bg-[#ff5a55]'
    : pressed
      ? 'bg-[#344054] ring-1 ring-white/15'
      : 'bg-[#202938] hover:bg-[#2d394b]'

  return (
    <button className={`group flex min-w-[58px] flex-col items-center gap-1.5 text-white disabled:cursor-not-allowed disabled:opacity-45 ${className}`} type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} title={label} disabled={disabled}>
      <span className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-95 sm:h-[54px] sm:w-[54px] ${color}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-medium text-white/75 sm:text-xs">{label}</span>
    </button>
  )
}

export function CallScreen({ status, error, roomId, localStream, remoteStream, localScreenStream, remoteScreenStream, muted, cameraOff, cameraFacing, switchingCamera, cameraSwitchError, screenSharing, remoteScreenSharing, screenShareError, remoteMuted, remoteCameraOff, leaveRoom, toggleMute, toggleCamera, switchCamera, toggleScreenShare }) {
  const isSharing = screenSharing || remoteScreenSharing
  const normalTileClass = 'relative'
  const sharedScreen = screenSharing ? localScreenStream : remoteScreenStream

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

      <section aria-label="Video call" className={isSharing ? 'relative min-h-0 flex-1 overflow-hidden bg-[#0a101a] p-2 sm:p-3 md:p-4' : 'grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-2 overflow-hidden bg-[#0a101a] px-2 pb-2 sm:gap-3 sm:px-4 sm:pb-3 md:grid-cols-2 md:grid-rows-1 md:px-6 md:pb-3 lg:px-8'}>
        {!isSharing ? (
          <>
            <VideoTile
              stream={remoteStream}
              label="Them"
              placeholder="Waiting for the other person to join…"
              videoDisabled={remoteCameraOff}
              videoDisabledLabel="Their camera is off"
              audioMuted={remoteMuted}
              className={normalTileClass}
            />
            <VideoTile
              stream={localStream}
              muted
              mirror={cameraFacing === 'user'}
              label={cameraOff ? 'You · camera off' : 'You'}
              placeholder="Starting your camera…"
              videoDisabled={cameraOff}
              audioMuted={muted}
              className={normalTileClass}
            />
          </>
        ) : (
          <div className="absolute inset-2 flex min-h-0 flex-col gap-2 sm:inset-3 sm:gap-3 md:inset-4 md:flex-row">
            <VideoTile
              stream={sharedScreen}
              muted
              label={screenSharing ? 'Your screen' : 'Their screen'}
              placeholder="Loading shared screen…"
              contain
              className="min-h-0 min-w-0 flex-1 rounded-xl border-white/10 md:rounded-2xl"
            />
            <aside aria-label="Call participants" className="flex h-[24%] min-h-24 shrink-0 gap-2 md:h-full md:w-56 md:flex-col md:gap-3 lg:w-64">
              <VideoTile
                stream={screenSharing ? localStream : remoteStream}
                muted={screenSharing}
                mirror={screenSharing && cameraFacing === 'user'}
                label={screenSharing ? (cameraOff ? 'You · camera off' : 'You') : 'Presenter'}
                placeholder={screenSharing ? 'Starting your camera…' : 'Presenter camera is off'}
                videoDisabled={screenSharing ? cameraOff : remoteCameraOff}
                audioMuted={screenSharing ? muted : remoteMuted}
                className="min-h-0 min-w-0 flex-1 rounded-xl md:rounded-2xl"
              />
              <VideoTile
                stream={screenSharing ? remoteStream : localStream}
                muted={!screenSharing}
                mirror={!screenSharing && cameraFacing === 'user'}
                label={screenSharing ? 'Them' : 'You'}
                placeholder={screenSharing ? 'Waiting for the other person to join…' : 'Starting your camera…'}
                videoDisabled={screenSharing ? remoteCameraOff : cameraOff}
                audioMuted={screenSharing ? remoteMuted : muted}
                className="min-h-0 min-w-0 flex-1 rounded-xl md:rounded-2xl"
              />
            </aside>
          </div>
        )}
        {isSharing && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-emerald-300/20 bg-emerald-500/90 px-3 py-1.5 text-center text-[11px] font-semibold text-white shadow-lg backdrop-blur sm:top-5 sm:px-4 sm:text-xs">
            {screenSharing ? 'You’re sharing your screen' : 'You’re viewing a shared screen'}
          </div>
        )}
      </section>

      <nav className="flex h-[88px] shrink-0 items-center justify-center gap-2 border-t border-white/[.06] bg-[#0b111c] px-3 pb-[max(.35rem,env(safe-area-inset-bottom))] sm:h-[100px] sm:gap-5" aria-label="Call controls">
        <ControlButton label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} pressed={muted} icon={muted ? MicOff : Mic} />
        <ControlButton label={cameraOff ? 'Start video' : 'Turn off camera'} onClick={toggleCamera} pressed={cameraOff} icon={cameraOff ? CameraOff : Camera} />
        <ControlButton label={switchingCamera ? 'Flipping…' : 'Flip'} onClick={switchCamera} disabled={switchingCamera || screenSharing} icon={RefreshCw} className="md:hidden" />
        <ControlButton label={screenSharing ? 'Stop sharing' : 'Share screen'} onClick={toggleScreenShare} pressed={screenSharing} icon={screenSharing ? ScreenShareOff : ScreenShare} disabled={status !== 'connected'} className="hidden md:flex" />
        <ControlButton label="Leave call" onClick={leaveRoom} danger icon={HangUpIcon} />
      </nav>

      {cameraSwitchError && <p role="alert" className="absolute inset-x-3 bottom-[96px] z-10 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-xl border border-rose-300/20 bg-[#321d25]/95 px-4 py-2.5 text-center text-xs text-rose-100 shadow-xl sm:bottom-[108px] sm:text-sm">{cameraSwitchError}</p>}
      {screenShareError && <p role="alert" className="absolute inset-x-3 bottom-[96px] z-10 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-xl border border-rose-300/20 bg-[#321d25]/95 px-4 py-2.5 text-center text-xs text-rose-100 shadow-xl sm:bottom-[108px] sm:text-sm">{screenShareError}</p>}
    </main>
  )
}
