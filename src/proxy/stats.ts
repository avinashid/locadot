import type { HostStats } from "../types";

export const record = (stats: Map<string, HostStats>, host: string, status: number, ms: number, error: boolean) => {
  const current = stats.get(host) || { hits: 0, errors: 0 };
  current.hits += 1;
  if (error) current.errors += 1;
  current.lastStatus = status;
  current.lastAccess = new Date().toISOString();
  current.avgMs = current.avgMs === undefined ? ms : Math.round(current.avgMs * 0.8 + ms * 0.2);
  stats.set(host, current);
};
