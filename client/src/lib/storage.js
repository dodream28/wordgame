const key = (roomCode) => `WRG_SESSION_${roomCode}`;
export function loadSession(roomCode){
  const raw = localStorage.getItem(key(roomCode));
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function saveSession(roomCode, payload){
  localStorage.setItem(key(roomCode), JSON.stringify(payload));
}
