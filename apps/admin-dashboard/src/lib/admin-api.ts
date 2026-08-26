/**
 * Admin API access — server-side only.
 * Auth: ADMIN_API_TOKEN (static, rotated) — fine for a 5-person ops team;
 * revisit if the ops org grows beyond that.
 */
const ADMIN_API_URL = process.env.ADMIN_API_URL ?? 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN ?? '';

export async function adminApi<T>(path: string): Promise<T> {
  const response = await fetch(`${ADMIN_API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    next: { revalidate: 30 },
  });
  if (!response.ok) {
    throw new Error(`adminApi ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
