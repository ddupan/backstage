# Homelab Backstage

The developer portal for the homelab. It is an independent application repository;
Kubernetes and Flux deployment declarations live in `homelab-infra`.

See [the architecture boundaries](docs/architecture.md) before adding deployment
or automation features.

Create a local environment (do not commit tokens), then start the app:

```sh
export GITEA_HOST=git.ddupan.top
export GITEA_ORG=panxiao81
export GITEA_TOKEN=replace-me
export AUTH_OIDC_CLIENT_ID=backstage
export AUTH_OIDC_CLIENT_SECRET=replace-me
export AUTH_SESSION_SECRET=replace-with-at-least-33-characters
```

```sh
yarn install
yarn start
```

The catalog polls all repositories in `GITEA_ORG` for a root-level
`catalog-info.yaml`. The token should be read-only for discovery. CI publishes
to Zot with the Gitea runner's short-lived `aud=zot` JWT-SVID; no long-lived
registry password belongs in repository secrets.

Human login goes directly to the homelab OIDC issuer (iam-login, sso.ddupan.top), as Gitea does. See
[authentication](docs/authentication.md) for the client registration contract.
