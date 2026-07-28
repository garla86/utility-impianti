const ADMIN_USER = 'luchino';
const ADMIN_PASSWORD_HASH = '3cc6d6194fe7c418a6bd65f022dfd399bae5dc65ceb23b9f86a83e74cec3da4f';
const SESSION_KEY = 'utility-impianti-admin-session';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

export function isAdminSession() { return sessionStorage.getItem(SESSION_KEY) === 'true'; }
export async function loginAdmin(username, password) {
  const valid = username.trim().toLowerCase() === ADMIN_USER && await sha256(password) === ADMIN_PASSWORD_HASH;
  if (valid) sessionStorage.setItem(SESSION_KEY, 'true');
  return valid;
}
export function logoutAdmin() { sessionStorage.removeItem(SESSION_KEY); }
