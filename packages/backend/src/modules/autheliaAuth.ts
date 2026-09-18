import { createBackendModule } from '@backstage/backend-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { oidcAuthenticator } from '@backstage/plugin-auth-backend-module-oidc-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/;

export function userRefFromClaims(claims: Record<string, unknown>): string {
  const preferredUsername = claims.preferred_username;

  if (typeof preferredUsername !== 'string') {
    throw new Error('Authelia did not return a preferred_username claim');
  }

  const username = preferredUsername.toLocaleLowerCase('en-US');
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Authelia returned an invalid preferred_username claim');
  }

  return stringifyEntityRef({
    kind: 'User',
    namespace: 'default',
    name: username,
  });
}

/**
 * Authenticates humans directly against the same Authelia OIDC issuer as Gitea.
 * This only establishes a Backstage identity; authorization remains separate.
 */
export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'authelia-oidc-provider',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'oidc',
          factory: createOAuthProviderFactory({
            authenticator: oidcAuthenticator,
            async signInResolver(info, ctx) {
              const userRef = userRefFromClaims(
                info.result.fullProfile.userinfo,
              );

              return ctx.issueToken({
                claims: {
                  sub: userRef,
                  ent: [userRef],
                },
              });
            },
          }),
        });
      },
    });
  },
});
