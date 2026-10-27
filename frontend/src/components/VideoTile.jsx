import { useEffect, useRef } from 'react'
import { MicOff } from 'lucide-react'

export const VideoTile = ({ stream, muted = false, mirror = false, label, placeholder, videoDisabled = false, videoDisabledLabel = 'Your camera is off', audioMuted = false }) => {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
  }, [stream])

  return (
    <article className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#121a26] shadow-[0_16px_48px_rgba(0,0,0,.28)] sm:rounded-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        aria-label={label}
        className="block h-full w-full object-cover"
        style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
      />

      {(!stream || videoDisabled) && (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_50%_42%,#202b3c_0%,#111925_66%,#0d141e_100%)] p-5 text-center">
          <div className="max-w-xs">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[.05] text-lg text-slate-300 shadow-inner sm:mb-4 sm:h-16 sm:w-16">
              {videoDisabled ? '◌' : '▣'}
            </div>
            <p className="text-xs leading-5 text-slate-300 sm:text-sm">{videoDisabled ? videoDisabledLabel : placeholder}</p>
          </div>
        </div>
      )}

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
      <span className="absolute bottom-2.5 left-2.5 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md sm:bottom-3 sm:left-3 sm:px-3 sm:text-xs">
        {label}
      </span>
      {audioMuted && (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md sm:right-3 sm:top-3 sm:text-xs" aria-label={`${label} is muted`}>
          <MicOff aria-hidden="true" className="h-3.5 w-3.5" />
          Muted
        </span>
      )}
    </article>
  )
}
