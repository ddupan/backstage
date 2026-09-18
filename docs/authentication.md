# Authentication

Backstage and Gitea are sibling relying parties of the same Authelia OIDC
issuer. Backstage does not delegate login to Gitea.

Register a confidential Authelia client with these properties:

| setting                    | value                                                  |
| -------------------------- | ------------------------------------------------------ |
| client ID                  | `backstage`                                            |
| scopes                     | `openid profile email groups`                          |
| production redirect URI    | `https://<backstage-host>/api/auth/oidc/handler/frame` |
| development redirect URI   | `http://localhost:7007/api/auth/oidc/handler/frame`    |
| token endpoint auth method | `client_secret_post`                                   |

The plaintext client secret is delivered to Backstage as
`AUTH_OIDC_CLIENT_SECRET`; Authelia keeps the corresponding hash. Store the
plaintext value in OpenBao and project it with External Secrets. Never commit
either value here.

The backend requires `preferred_username` and maps it to
`user:default/<preferred_username>`. Authentication only establishes identity.
It does not grant Kubernetes, Flux, registry, or deployment permissions.

Required runtime variables are:

- `AUTH_OIDC_CLIENT_ID`
- `AUTH_OIDC_CLIENT_SECRET`
- `AUTH_SESSION_SECRET` (at least 33 characters)

After the deployment hostname is chosen, the Authelia client registration and
ExternalSecret belong in `homelab-infra`, alongside the Backstage deployment
declarations.
