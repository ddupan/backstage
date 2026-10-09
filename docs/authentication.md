# Authentication

Backstage and Gitea are sibling relying parties of the same OIDC issuer (iam-login, `sso.ddupan.top`).
Backstage does not delegate login to Gitea. The issuer comes from `AUTH_OIDC_METADATA_URL`, so moving
to another issuer is a deployment change, not an image change.

The client is registered in `homelab-infra` (`apps/iam-login/terraform/clients.tf`) with these properties:

| setting                    | value                                                  |
| -------------------------- | ------------------------------------------------------ |
| client ID                  | `backstage`                                            |
| scopes                     | `openid profile email groups`                          |
| production redirect URI    | `https://<backstage-host>/api/auth/oidc/handler/frame` |
| token endpoint auth method | `client_secret_basic`                                  |
| PKCE                       | off: the oidc provider module does not send it         |

Terraform writes the client secret to OpenBao and External Secrets projects it as
`AUTH_OIDC_CLIENT_SECRET`. Never commit it here.

The backend requires `preferred_username` (read from userinfo) and maps it to
`user:default/<preferred_username>`. Authentication only establishes identity.
It does not grant Kubernetes, Flux, registry, or deployment permissions.

Required runtime variables are:

- `AUTH_OIDC_METADATA_URL` (the issuer's `/.well-known/openid-configuration`)
- `AUTH_OIDC_CLIENT_ID`
- `AUTH_OIDC_CLIENT_SECRET`
- `AUTH_SESSION_SECRET` (at least 33 characters)

## Authorization

`packages/backend/src/modules/permissionPolicy.ts` replaces the allow-all
policy: `user:default/panxiao81` may do anything, and every other signed-in user
may only perform `read` permissions. Permissions without an action, such as
`kubernetes.proxy` and `scaffolder.action.execute`, count as writes and are
denied. Service-to-service calls bypass the policy.
