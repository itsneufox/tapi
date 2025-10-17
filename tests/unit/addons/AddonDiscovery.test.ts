import * as fs from 'fs';
import * as path from 'path';
import { AddonDiscovery } from '../../../src/core/addons/AddonDiscovery';
import { AddonLoader } from '../../../src/core/addons/loader';
import { createTempDir } from '../../setup';
import { TapiAddon } from '../../../src/core/addons/types';

const makePackageJson = (name: string) => ({
  name,
  version: '1.0.0',
  description: 'Addon',
  author: 'tester',
  license: 'MIT',
  main: 'index.js',
  tapi: {
    name,
    version: '1.0.0',
    description: 'Addon',
    author: 'tester',
    license: 'MIT',
  },
});

const sampleAddon: TapiAddon = {
  name: 'tapi-sample',
  version: '1.0.0',
  description: 'Addon',
  author: 'tester',
  license: 'MIT',
  hooks: {},
};

describe('AddonDiscovery', () => {
  test('discovers addons in node_modules and registers them', async () => {
    const projectDir = createTempDir();
    const nodeModulesAddonPath = path.join(projectDir, 'node_modules', 'tapi-sample');
    fs.mkdirSync(nodeModulesAddonPath, { recursive: true });
    fs.writeFileSync(
      path.join(nodeModulesAddonPath, 'package.json'),
      JSON.stringify(makePackageJson('tapi-sample'), null, 2),
      'utf8'
    );
    fs.writeFileSync(path.join(nodeModulesAddonPath, 'index.js'), '', 'utf8');

    const loadAddon = jest.fn().mockResolvedValue(sampleAddon);
    const registerAddon = jest.fn();
    const getAddonInfo = jest.fn().mockReturnValue(undefined);
    const loader = { loadAddon, registerAddon, getAddonInfo } as unknown as AddonLoader;

    const discovery = new AddonDiscovery(loader);
    await discovery.discoverNodeModulesAddons(projectDir, path.join(projectDir, 'global'), false);

    expect(loadAddon).toHaveBeenCalledWith(path.join(nodeModulesAddonPath, 'index.js'));
    expect(registerAddon).toHaveBeenCalled();
  });

  test('searchNodeModulesAddons finds matching addons', async () => {
    const projectDir = createTempDir();
    const nodeModulesAddonPath = path.join(projectDir, 'node_modules', 'tapi-sample');
    fs.mkdirSync(nodeModulesAddonPath, { recursive: true });
    fs.writeFileSync(
      path.join(nodeModulesAddonPath, 'package.json'),
      JSON.stringify(makePackageJson('tapi-sample'), null, 2),
      'utf8'
    );
    fs.writeFileSync(path.join(nodeModulesAddonPath, 'index.js'), '', 'utf8');

    const loader = {
      loadAddon: jest.fn(),
      registerAddon: jest.fn(),
      getAddonInfo: jest.fn(),
    } as unknown as AddonLoader;

    const discovery = new AddonDiscovery(loader);
    const results = await discovery.searchNodeModulesAddons(
      'sample',
      projectDir,
      path.join(projectDir, 'global')
    );

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('tapi-sample');
  });
});
