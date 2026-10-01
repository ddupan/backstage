# Backstage handoff

更新时间：2026-10-01

本文记录 Homelab Backstage 第一版的当前状态、边界、发布方式和已知后续工作。动态状态应以集群、Gitea Actions 和 Flux 的实时结果为准。

## 仓库与职责边界

- `panxiao81/backstage`（本仓库）是独立应用源码仓库，维护 Backstage 源码、插件、配置模板、测试、Dockerfile 和 Gitea Actions CI。
- `/home/panxiao81/services` 对应 `panxiao81/homelab-infra`，仅维护 Kubernetes/Flux 部署声明。不要把应用源码、插件或构建文件放进去。
- 各服务的 `catalog-info.yaml` 原则上归各自源码仓库；Backstage 通过 Gitea discovery 或显式 `Location` 聚合。
- Backstage 只读观察 Gitea、Kubernetes 和 Flux。需要变更时可以创建 PR，但不能直接 apply 资源或充当部署控制器。

目标发布链路是：

```text
backstage CI 测试/构建 -> Zot -> homelab-infra digest PR -> Flux
```

当前 CI 已完成测试、镜像构建、Zot 推送和 `image-reference` artifact 产出；自动创建 `homelab-infra` digest PR 尚未实现，目前需根据 artifact 手工创建 PR。

## 当前线上快照

| 项目           | 当前值                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| 入口           | `https://backstage.ad.ddupan.top`                                                                               |
| Backstage 版本 | `1.55.0`                                                                                                        |
| 镜像           | `zot.ad.ddupan.top/panxiao81/backstage@sha256:008a3ccf832c9ee061ef03766022789a7539bd9d001a658af2e9f3ff59a9a5cc` |
| 应用状态       | Deployment `1/1 Ready`，Pod 0 重启（2026-10-01 核对）                                                           |
| Flux           | `flux-system/backstage` Ready                                                                                   |
| 数据库         | `shared-postgresql-rw.shared-db.svc.cluster.local:5432/backstage`                                               |
| Secret 来源    | OpenBao `kv/k8s/backstage`，由 External Secrets 投射                                                            |
| OIDC issuer    | `https://auth.ddupan.top`（Authelia）                                                                           |
| Catalog 实体   | `component:default/homelab-backstage`                                                                           |

健康检查：

```sh
curl -fsS https://backstage.ad.ddupan.top/.backstage/health/v1/readiness
kubectl -n backstage get deployment,pod
kubectl -n flux-system get kustomization backstage
```

## 认证与密钥

人类登录直接使用 Authelia OIDC。Backstage 与 Gitea 是同一 issuer 下相互独立的 relying party；Backstage 不把 Gitea 当 OAuth provider。

生产 OIDC 回调地址：

```text
https://backstage.ad.ddupan.top/api/auth/oidc/handler/frame
```

运行时 Secret 至少需要提供以下键，值不得提交到 Git：

- `AUTH_OIDC_CLIENT_ID`
- `AUTH_OIDC_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- `BACKEND_SECRET`
- `GITEA_TOKEN`
- `POSTGRES_PASSWORD`

`BACKEND_SECRET` 当前用于：

```yaml
backend:
  auth:
    externalAccess:
      - type: legacy
        options:
          secret: ${BACKEND_SECRET}
          subject: backstage-server
```

不要删除 `subject`。当前 Backstage 版本将它视为必填项；缺失会导致所有 backend plugin 启动失败。

## 已启用的后端能力

入口位于 `packages/backend/src/index.ts`，当前包括：

- App、Proxy、Scaffolder、TechDocs
- Authelia OIDC auth module
- Catalog 与 Gitea catalog module
- Permission（当前仍为 allow-all policy）
- PostgreSQL Search
- Kubernetes backend
- User Settings
- Notifications、Signals
- Events backend

Events 使用 PostgreSQL store。正常启动时应看到：

```text
Database is PostgreSQL, using database store
Registered scheduled task: event-bus-cleanup
PUT /api/events/bus/v1/subscriptions/catalog.catalog ... 201
PUT /api/events/bus/v1/subscriptions/signals.* ... 201
```

如果重新出现 events subscription `404`，先确认 `@backstage/plugin-events-backend` 仍在依赖中且已通过 `backend.add(...)` 注册。

## PostgreSQL 模式

所有插件共用 `backstage` 数据库，并通过以下配置隔离 schema：

```yaml
backend:
  database:
    pluginDivisionMode: schema
    schemaPrefix: backstage_
```

这避免授予应用角色集群级 `CREATEDB` 权限。不要改回默认的每插件数据库模式，除非同步调整 PostgreSQL 权限和迁移方案。

## Kubernetes 观察权限

Backstage 使用 Pod 内投射、自动轮换的 ServiceAccount token，不保存静态 Kubernetes token。Catalog 实体和 Deployment/Pod 使用：

```yaml
backstage.io/kubernetes-id: homelab-backstage
```

`backstage-read-only` ClusterRole 只授予工作负载相关资源的 `get/list/watch`；不允许读取 Secret，也没有 create/update/patch/delete 权限。发布后可复核：

```sh
kubectl auth can-i --as=system:serviceaccount:backstage:backstage list pods --all-namespaces
kubectl auth can-i --as=system:serviceaccount:backstage:backstage get secrets --all-namespaces
kubectl auth can-i --as=system:serviceaccount:backstage:backstage create deployments.apps --all-namespaces
kubectl auth can-i --as=system:serviceaccount:backstage:backstage delete pods --all-namespaces
```

期望输出依次为 `yes`、`no`、`no`、`no`。

## CI 与镜像

工作流：`.gitea/workflows/ci.yml`

- `pull_request`：运行 verify；image job 跳过。
- `push` 到 `main`：运行 verify，随后构建并推送镜像。
- `workflow_dispatch`：提供 runner 状态异常后的手动重跑入口；当前 image job 条件只允许 main push，因此手动触发默认只做 verify。
- Runner label：`[self-hosted, pod]`。
- Node：24。
- 构建镜像使用 `packages/backend/Dockerfile` 的多阶段构建。
- Zot 写入口：`zot-push.ad.ddupan.top`；部署拉取入口：`zot.ad.ddupan.top`。
- CI 通过 SPIRE 获取短期 `aud=zot` JWT-SVID 登录 Zot，不使用长期 registry password。
- Gitea Actions 目前使用 artifact v3；不要切到 GitHub artifact v4 action。

本地合并前验证：

```sh
yarn install --immutable
yarn ci
yarn build:backend
yarn backstage-cli config:check --strict --lax \
  --config app-config.yaml \
  --config app-config.production.yaml
git diff --check
```

严格 config check 很重要：TypeScript、lint 和测试不会实例化所有生产配置 schema。

## 发布操作

1. 在本仓库创建 PR，并等待 verify 成功。
2. 合并到 `main`，等待 push workflow 的 verify 和 image job 全部成功。
3. 从 `image-reference` artifact 或 image job 日志取得 `zot.ad.ddupan.top/...@sha256:...`。
4. 从 `homelab-infra` 最新 `origin/main` 创建隔离 worktree。用户的 `/home/panxiao81/services` 工作区可能有未提交改动，不要直接修改、清理或 reset。
5. 只更新 `apps/backstage/deployment.yaml` 中的镜像 digest。
6. 运行 `kubectl kustomize apps/backstage` 和 `git diff --check`，然后创建部署 PR。
7. 合并后等待 Flux；不要用 Backstage 或手工 `kubectl set image` 绕过 GitOps。
8. 验证 digest、Pod readiness、外部 HTTPS 和启动日志。

常用验收命令：

```sh
kubectl -n backstage rollout status deployment/backstage --timeout=5m
kubectl -n backstage get deployment backstage \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n backstage logs deployment/backstage --tail=300
curl -fsS -o /dev/null -w '%{http_code}\n' \
  https://backstage.ad.ddupan.top/.backstage/health/v1/readiness
```

## 部署资源位置

以下内容只存在于 `homelab-infra/apps/backstage/`：

- Namespace
- ServiceAccount 与只读 ClusterRole/ClusterRoleBinding
- ExternalSecret
- Deployment、Service
- NetworkPolicy
- HTTPRoute
- Kustomization

Deployment 当前使用 `Recreate` 策略，因此升级时可能有短暂不可用窗口。若要改为 RollingUpdate，先确认资源、数据库迁移和存储行为允许新旧版本短时间并存。

## 已知事故与教训

2026-09-29 首次迁移 `backend.auth.keys` 时，`externalAccess` 的 legacy provider 缺少 `options.subject`。静态测试和构建通过，但生产 backend 初始化失败。处理过程是：

1. 通过 `homelab-infra` PR 回退到上一健康 digest；
2. 为 legacy provider 添加 `subject: backstage-server`；
3. 增加生产配置严格 schema 检查；
4. 重新构建镜像并通过 digest PR 上线。

同日一个 Actions run 曾在 runner Pod 消失后长时间停留在 `in_progress`。随后添加了 `workflow_dispatch`，并通过新的 main push 完成了成功构建。排障时优先保留失败 run 和日志，不要直接删除证据。

## 后续工作

按优先级建议：

1. 自动创建 `homelab-infra` digest PR，同时保持 Backstage/CI 无直接部署权限。
2. 为 production config schema check 增加 CI 步骤，避免只在人工本地验证。
3. 将 Permission 的 allow-all policy 替换为明确策略。
4. 将 catalog 从单个显式 Location 扩展为适合个人 owner 的 Gitea 聚合方案；服务描述仍留在各自源码仓库。
5. 评估 TechDocs 从本地 builder/publisher 迁移到 CI 构建和对象存储。
6. 评估 Deployment 从 Recreate 切换到 RollingUpdate，并记录数据库迁移兼容约束。

## 相关文档

- [架构边界](architecture.md)
- [认证约定](authentication.md)
- [项目入口](../README.md)
