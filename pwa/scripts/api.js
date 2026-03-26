const SERVER_URL = window.location.origin;

export async function fetchHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

export async function fetchDetections() {
  try {
    const res = await fetch(`${SERVER_URL}/detections`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.json();
    return [];
  } catch {
    return [];
  }
}

export async function registerTokenOnServer(token) {
  try {
    await fetch(`${SERVER_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return true;
  } catch (err) {
    console.error("Token registration error:", err);
    return false;
  }
}

export async function resetSystemAPI() {
  try {
    const res = await fetch(`${SERVER_URL}/reset`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
