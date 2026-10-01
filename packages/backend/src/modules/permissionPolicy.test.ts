import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { PolicyQueryUser } from '@backstage/plugin-permission-node';
import { ReadOnlyUnlessAdminPolicy } from './permissionPolicy';

const policy = new ReadOnlyUnlessAdminPolicy();

const user = (userEntityRef: string) =>
  ({ info: { userEntityRef } } as PolicyQueryUser);

const query = (action?: 'create' | 'read' | 'update' | 'delete') => ({
  permission: {
    type: 'basic' as const,
    name: 'test.permission',
    attributes: action ? { action } : {},
  },
});

describe('ReadOnlyUnlessAdminPolicy', () => {
  it.each([undefined, 'create', 'read', 'update', 'delete'] as const)(
    'allows the admin everything (action %p)',
    async action => {
      await expect(
        policy.handle(query(action), user('user:default/panxiao81')),
      ).resolves.toEqual({ result: AuthorizeResult.ALLOW });
    },
  );

  it('allows other users to read', async () => {
    await expect(
      policy.handle(query('read'), user('user:default/guest')),
    ).resolves.toEqual({ result: AuthorizeResult.ALLOW });
  });

  it.each([undefined, 'create', 'update', 'delete'] as const)(
    'denies other users anything but read (action %p)',
    async action => {
      await expect(
        policy.handle(query(action), user('user:default/guest')),
      ).resolves.toEqual({ result: AuthorizeResult.DENY });
      await expect(policy.handle(query(action))).resolves.toEqual({
        result: AuthorizeResult.DENY,
      });
    },
  );
});
