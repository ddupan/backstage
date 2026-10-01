# Architecture boundaries

This repository owns the Backstage application: source code, plugins,
configuration templates, tests, and the Gitea Actions workflow that publishes
the application image to Zot.

The `homelab-infra` repository owns only the Kubernetes and Flux declarations
that deploy Backstage. It must pin the image produced here by digest. Application
source, plugins, and build configuration do not belong there.

The delivery path is:

1. this repository tests and builds Backstage;
2. CI pushes the image to Zot and records its immutable digest;
3. a pull request against `homelab-infra` updates that digest;
4. Flux applies the merged deployment declaration.

CI currently records the immutable image reference as an artifact; automatic
creation of the `homelab-infra` pull request is planned but not implemented.

Backstage observes Gitea, Kubernetes, and Flux. It may propose changes through
pull requests, but it must not apply Kubernetes resources or reconcile
deployments directly.

Service catalog descriptors remain in each service's source repository as
`catalog-info.yaml`. The catalog backend discovers them through Gitea. Explicit
catalog `Location` resources are reserved for repositories that cannot follow
that convention.
