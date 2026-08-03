import { describe, expect, it } from 'vitest';
import { isInvitationCallback, mustChangeTemporaryPassword } from './authFlow';

describe('isInvitationCallback', () => {
  it('riconosce il marcatore aggiunto al link di invito', () => {
    expect(isInvitationCallback({ search: '?invited=1', hash: '' })).toBe(true);
  });

  it('riconosce il tipo invite restituito da Supabase', () => {
    expect(isInvitationCallback({ search: '', hash: '#access_token=test&type=invite' })).toBe(true);
  });

  it('non modifica il normale accesso', () => {
    expect(isInvitationCallback({ search: '', hash: '' })).toBe(false);
  });
});

describe('mustChangeTemporaryPassword', () => {
  it('obbliga il cambio solo per gli account con password provvisoria', () => {
    expect(mustChangeTemporaryPassword({ user_metadata: { must_change_password: true } })).toBe(true);
    expect(mustChangeTemporaryPassword({ user_metadata: { must_change_password: false } })).toBe(false);
    expect(mustChangeTemporaryPassword(null)).toBe(false);
  });
});
