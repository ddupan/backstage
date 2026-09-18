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

const autheliaAuthApiRef = createApiRef<
  OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>().with({ id: 'auth.authelia' });

const autheliaAuthApi = ApiBlueprint.make({
  name: 'authelia',
  params: defineParams =>
    defineParams({
      api: autheliaAuthApiRef,
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
            title: 'Authelia',
            icon: () => null,
          },
          defaultScopes: ['openid', 'profile', 'email', 'groups'],
        }),
    }),
});

const autheliaSignInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props =>
      (
        <SignInPage
          {...props}
          provider={{
            id: 'authelia',
            title: 'Authelia',
            message: 'Sign in with the homelab identity provider',
            apiRef: autheliaAuthApiRef,
          }}
        />
      ),
  },
});

const autheliaAuthModule = createFrontendModule({
  pluginId: 'app',
  extensions: [autheliaAuthApi, autheliaSignInPage],
});

export default createApp({
  features: [catalogPlugin, navModule, homeModule, autheliaAuthModule],
});
