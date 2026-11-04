export type CallSignal = {
  id: string
  instance: string
  senderId: string
  senderName: string
  createdAt: string
  type: "join" | "offer" | "answer" | "ice" | "leave" | "video-toggle"
  target?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  hasVideo?: boolean
}
export type OutgoingCallSignal = Omit<CallSignal, "id" | "instance" | "senderId" | "senderName" | "createdAt">

/** One transport and one negotiation queue: candidates wait for the remote SDP. */
export function createCallNegotiator(pc: RTCPeerConnection, options: {
  instance: string
  hasVideo: () => boolean
  send: (signal: OutgoingCallSignal) => void
  onPeer: (name: string, hasVideo: boolean) => void
  onLeave: () => void
  onError: (error: unknown) => void
}) {
  let remoteInstance: string | null = null
  let makingOffer = false, ignoreOffer = false
  const pendingIce: RTCIceCandidateInit[] = []
  const send = (signal: OutgoingCallSignal) => options.send({ ...signal, ...(remoteInstance ? { target: remoteInstance } : {}) })
  async function negotiate() {
    if (!remoteInstance || makingOffer || pc.signalingState !== "stable") return
    try {
      makingOffer = true
      await pc.setLocalDescription(await pc.createOffer())
      if (pc.localDescription) send({ type: "offer", sdp: pc.localDescription.toJSON(), hasVideo: options.hasVideo() })
    } catch (error) { options.onError(error) }
    finally { makingOffer = false }
  }
  pc.onnegotiationneeded = () => { void negotiate() }
  pc.onicecandidate = event => { if (event.candidate) send({ type: "ice", candidate: event.candidate.toJSON() }) }
  return {
    notifyVideo: () => send({ type: "video-toggle", hasVideo: options.hasVideo() }),
    async handle(signal: CallSignal) {
      if (signal.instance === options.instance || (signal.target && signal.target !== options.instance)) return
      if (remoteInstance && signal.instance !== remoteInstance) return
      remoteInstance = signal.instance
      if (signal.type === "join" || signal.type === "offer" || signal.type === "answer" || signal.type === "video-toggle") options.onPeer(signal.senderName, Boolean(signal.hasVideo))
      if (signal.type === "leave") { options.onLeave(); return }
      if (signal.type === "join") { await negotiate(); return }
      if (signal.type === "video-toggle") return
      if (signal.sdp) {
        const collision = signal.sdp.type === "offer" && (makingOffer || pc.signalingState !== "stable")
        const polite = options.instance > signal.instance
        ignoreOffer = collision && !polite
        if (ignoreOffer) return
        await pc.setRemoteDescription(signal.sdp)
        while (pendingIce.length) await pc.addIceCandidate(pendingIce.shift()!)
        if (signal.sdp.type === "offer") {
          await pc.setLocalDescription(await pc.createAnswer())
          if (pc.localDescription) send({ type: "answer", sdp: pc.localDescription.toJSON(), hasVideo: options.hasVideo() })
        }
      } else if (signal.candidate && !ignoreOffer) {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate)
        else pendingIce.push(signal.candidate)
      }
    },
  }
}
