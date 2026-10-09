import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  AuthorizeResult,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';

// ponytail: hard-coded admin list; move to config or an identity-provider group when
// there is more than one admin.
const ADMINS = new Set(['user:default/panxiao81']);

/**
 * Admins may do anything; every other signed-in user may only read.
 * Permissions without an action (e.g. kubernetes.proxy,
 * scaffolder.action.execute) are not reads and are denied.
 * Service-to-service calls never reach this policy.
 */
export class ReadOnlyUnlessAdminPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    if (user && ADMINS.has(user.info.userEntityRef)) {
      return { result: AuthorizeResult.ALLOW };
    }
    return {
      result:
        request.permission.attributes.action === 'read'
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
    };
  }
}

export default createBackendModule({
  pluginId: 'permission',
  moduleId: 'read-only-unless-admin-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new ReadOnlyUnlessAdminPolicy());
      },
    });
  },
});
