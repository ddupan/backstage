import {
  coreServices,
  createBackendModule,
  LoggerService,
  SchedulerServiceTaskRunner,
} from '@backstage/backend-plugin-api';
import {
  getGiteaRequestOptions,
  ScmIntegrations,
} from '@backstage/integration';
import {
  catalogProcessingExtensionPoint,
  EntityProvider,
  EntityProviderConnection,
  locationSpecToLocationEntity,
} from '@backstage/plugin-catalog-node';

// ponytail: single hard-coded owner; the upstream Gitea provider only lists
// organizations. Switch back to it if these repositories move to an org.
const OWNER = 'panxiao81';
const CATALOG_PATH = 'catalog-info.yaml';

type GiteaRepo = {
  html_url: string;
  default_branch: string;
  empty: boolean;
  archived: boolean;
};

/**
 * One optional Location per repository: repositories without a
 * catalog-info.yaml are skipped by the catalog instead of erroring, so there
 * is no per-repository existence check.
 */
export function locationTargets(repos: GiteaRepo[]): string[] {
  return repos
    .filter(repo => !repo.empty && !repo.archived)
    .map(
      repo =>
        `${repo.html_url}/src/branch/${repo.default_branch}/${CATALOG_PATH}`,
    );
}

class GiteaUserReposProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  constructor(
    private readonly host: string,
    private readonly integrations: ScmIntegrations,
    private readonly logger: LoggerService,
    private readonly taskRunner: SchedulerServiceTaskRunner,
  ) {}

  getProviderName() {
    return `gitea-user-repos:${OWNER}`;
  }

  async connect(connection: EntityProviderConnection) {
    this.connection = connection;
    await this.taskRunner.run({
      id: `${this.getProviderName()}:refresh`,
      fn: async () => {
        try {
          await this.refresh();
        } catch (error) {
          this.logger.error(
            `${this.getProviderName()} refresh failed: ${error}`,
          );
        }
      },
    });
  }

  private async refresh() {
    const integration = this.integrations.gitea.byHost(this.host);
    if (!integration) {
      throw new Error(`No Gitea integration configured for ${this.host}`);
    }
    const repos: GiteaRepo[] = [];
    for (let page = 1; ; page++) {
      const res = await fetch(
        `${integration.config.baseUrl}/api/v1/users/${OWNER}/repos?limit=50&page=${page}`,
        getGiteaRequestOptions(integration.config),
      );
      if (!res.ok) {
        throw new Error(`Listing ${OWNER} repositories failed: ${res.status}`);
      }
      const batch = (await res.json()) as GiteaRepo[];
      if (batch.length === 0) break;
      repos.push(...batch);
    }
    const entities = locationTargets(repos).map(target => ({
      locationKey: this.getProviderName(),
      entity: locationSpecToLocationEntity({
        location: { type: 'url', target, presence: 'optional' },
      }),
    }));
    await this.connection!.applyMutation({ type: 'full', entities });
    this.logger.info(
      `${this.getProviderName()} registered ${entities.length} repositories`,
    );
  }
}

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'gitea-user-discovery',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
      },
      async init({ catalog, config, logger, scheduler }) {
        const integrations = ScmIntegrations.fromConfig(config);
        const host = integrations.gitea.list()[0]?.config.host;
        if (!host) {
          throw new Error('gitea-user-discovery needs integrations.gitea');
        }
        catalog.addEntityProvider(
          new GiteaUserReposProvider(
            host,
            integrations,
            logger,
            scheduler.createScheduledTaskRunner({
              frequency: { minutes: 30 },
              timeout: { minutes: 3 },
            }),
          ),
        );
      },
    });
  },
});
