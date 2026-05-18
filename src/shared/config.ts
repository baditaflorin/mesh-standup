export const appConfig = {
  appName: "mesh-standup",
  storagePrefix: "mesh-standup",
  description:
    "Peer-to-peer mesh standup timer. Each phone is a slot; tap or scan ArUco markers to advance speakers in lockstep.",
  accentHex: "#f9b956",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-standup",
  pagesUrl: "https://baditaflorin.github.io/mesh-standup/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
