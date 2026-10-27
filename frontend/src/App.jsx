import { useState } from 'react'
import { CallScreen } from './components/CallScreen'
import { LandingScreen } from './components/LandingScreen'
import { useVideoCall } from './hooks/useVideoCall'

function App() {
  const call = useVideoCall()
  const [roomInput, setRoomInput] = useState('studio-1')
  const inCall = ['connecting', 'waiting', 'connected'].includes(call.status)

  if (!inCall) {
    return (
      <LandingScreen
        status={call.status}
        error={call.error}
        roomInput={roomInput}
        onRoomInputChange={setRoomInput}
        onJoin={() => void call.joinRoom(roomInput)}
      />
    )
  }

  return <CallScreen {...call} />
}

export default App
