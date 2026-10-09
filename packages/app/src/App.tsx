import { createApp } from '@backstage/frontend-defaults';
import { OAuth2 } from '@backstage/core-app-api';
import { SignInPage } from '@backstage/core-components';
import {
  BackstageIdentityApi,
  OpenIdConnectApi,
  ProfileInfoApi,
  SessionApi,
} from '@backstage/core-plugin-api';
import {
  ApiBlueprint,
  configApiRef,
  createApiRef,
  createFrontendModule,
  discoveryApiRef,
  oauthRequestApiRef,
} from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';

const ssoAuthApiRef = createApiRef<
  OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>().with({ id: 'auth.sso' });

const ssoAuthApi = ApiBlueprint.make({
  name: 'sso',
  params: defineParams =>
    defineParams({
      api: ssoAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
        OAuth2.create({
          configApi,
          discoveryApi,
          oauthRequestApi,
          environment: configApi.getOptionalString('auth.environment'),
          provider: {
            id: 'oidc',
            title: 'SSO',
            icon: () => null,
          },
          defaultScopes: ['openid', 'profile', 'email', 'groups'],
        }),
    }),
});

const ssoSignInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props =>
      (
        <SignInPage
          {...props}
          provider={{
            id: 'sso',
            title: 'SSO',
            message: 'Sign in with the homelab identity provider',
            apiRef: ssoAuthApiRef,
          }}
        />
      ),
  },
});

const ssoAuthModule = createFrontendModule({
  pluginId: 'app',
  extensions: [ssoAuthApi, ssoSignInPage],
});

export default createApp({
  features: [catalogPlugin, navModule, homeModule, ssoAuthModule],
});
