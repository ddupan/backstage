import { locationTargets } from './giteaUserDiscovery';

const repo = (name: string, extra: object = {}) => ({
  html_url: `https://git.example/owner/${name}`,
  default_branch: 'main',
  empty: false,
  archived: false,
  ...extra,
});

describe('locationTargets', () => {
  it('points at catalog-info.yaml on the default branch', () => {
    expect(
      locationTargets([repo('a'), repo('b', { default_branch: 'trunk' })]),
    ).toEqual([
      'https://git.example/owner/a/src/branch/main/catalog-info.yaml',
      'https://git.example/owner/b/src/branch/trunk/catalog-info.yaml',
    ]);
  });

  it('skips empty and archived repositories', () => {
    expect(
      locationTargets([
        repo('empty', { empty: true }),
        repo('old', { archived: true }),
      ]),
    ).toEqual([]);
  });
});
