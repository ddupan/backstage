import { userRefFromClaims } from './autheliaAuth';

describe('userRefFromClaims', () => {
  it('maps an Authelia username to a Backstage user ref', () => {
    expect(userRefFromClaims({ preferred_username: 'PanXiao81' })).toBe(
      'user:default/panxiao81',
    );
  });

  it.each([
    {},
    { preferred_username: 42 },
    { preferred_username: '../admin' },
    { preferred_username: 'name with spaces' },
  ])('rejects missing or invalid usernames: %p', claims => {
    expect(() => userRefFromClaims(claims)).toThrow();
  });
});
