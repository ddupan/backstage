# Architecture boundaries

This repository owns the Backstage application: source code, plugins,
configuration templates, tests, and the Gitea Actions workflow that publishes
the application image to Zot.

The `homelab-infra` repository owns only the Kubernetes and Flux declarations
that deploy Backstage. It pins the image produced here by digest. Application
source, plugins, and build configuration do not belong there.

The delivery path is:

1. this repository tests and builds Backstage on every push to `main`;
2. CI pushes only the `:latest` tag to Zot;
3. Flux image automation in `homelab-infra` resolves the digest behind
   `:latest` and commits it to the deployment as `flux-bot`;
4. Flux applies that commit.

The running environment is a development deployment. Releases with versioned,
pinned images are deferred until a production environment exists.

Documentation is published separately: each repository's `techdocs` CI job
builds its TechDocs and uploads them to the shared SeaweedFS `techdocs` bucket,
which Backstage reads. Changing docs does not rebuild the image.

Backstage observes Gitea, Kubernetes, and Flux. It may propose changes through
pull requests, but it must not apply Kubernetes resources or reconcile
deployments directly.

Service catalog descriptors remain in each service's source repository as
`catalog-info.yaml`. The catalog backend discovers them through Gitea. Explicit
catalog `Location` resources are reserved for repositories that cannot follow
that convention.
