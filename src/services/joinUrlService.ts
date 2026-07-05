export interface NetworkInfo {
  localIp: string;
  port: number;
  localUrl: string;
}

let cachedNetworkInfo: { data: NetworkInfo, timestamp: number } | null = null;
let fetchPromise: Promise<NetworkInfo | null> | null = null;
const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Gets the current network information securely and caches it briefly.
 * Calls /api/network-info from the local Express server.
 */
export async function getNetworkInfo(forceRefresh = false): Promise<NetworkInfo | null> {
  const now = Date.now();
  
  if (!forceRefresh && cachedNetworkInfo && (now - cachedNetworkInfo.timestamp < CACHE_TTL_MS)) {
    return cachedNetworkInfo.data;
  }
  
  if (!fetchPromise) {
    fetchPromise = fetch("/api/network-info")
      .then(res => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then(data => {
        cachedNetworkInfo = { data, timestamp: Date.now() };
        fetchPromise = null;
        return data;
      })
      .catch(err => {
        console.warn("Could not fetch network info:", err);
        fetchPromise = null;
        return null;
      });
  }
  
  return fetchPromise;
}

/**
 * Centralized service for building URLs for students to join games.
 * This guarantees consistency across all modules and prevents 'localhost'
 * from being hardcoded in QR codes shown to mobile devices.
 */
export async function buildJoinUrl({ pin, game }: { pin: string; game?: string }): Promise<string> {
  const host = window.location.hostname;
  const isCloudEnv = host.includes("run.app") || host.includes("prepmaster.live");

  const appendParams = (baseUrl: string) => {
    let url = `${baseUrl}/join?pin=${pin}`;
    if (game) {
      url += `&game=${game}`;
    }
    return url;
  };

  if (isCloudEnv) {
    return appendParams(window.location.origin);
  }

  const networkInfo = await getNetworkInfo();
  if (networkInfo && networkInfo.localIp) {
    const localUrl = `http://${networkInfo.localIp}:${networkInfo.port}`;
    return appendParams(localUrl);
  }

  // Fallback to origin if it's not localhost/127.0.0.1
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return appendParams(window.location.origin);
  }

  // Final fallback (could still be localhost, but we've tried everything)
  return appendParams(window.location.origin);
}
