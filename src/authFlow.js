export function isInvitationCallback(location = window.location) {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return query.get('invited') === '1' || hash.get('type') === 'invite';
}

export function clearInvitationCallback() {
  const url = new URL(window.location.href);
  url.searchParams.delete('invited');
  url.hash = '';
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}
