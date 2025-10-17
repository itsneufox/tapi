import * as path from 'path';
import * as fs from 'fs';
import { AddonInstaller, InstallOptions } from '../../../src/core/addons/AddonInstaller';
import { AddonLoader } from '../../../src/core/addons/loader';
import { HookManager } from '../../../src/core/addons/hooks';
import { AddonRegistry } from '../../../src/core/addons/AddonRegistry';
import { GitHubDownloader } from '../../../src/core/addons/GitHubDownloader';
import { createTempDir } from '../../setup';
import { TapiAddon } from '../../../src/core/addons/types';

function makeFakeAddon(name = 'tapi-test', version = '1.0.0'): TapiAddon {
  return {
    name,
    version,
    description: 'Addon',
    author: 'tester',
    license: 'MIT',
    hooks: {},
  };
}

describe('AddonInstaller', () => {
  test('installs from local path and registers', async () => {
    const tmp = createTempDir();
    const addonPath = path.join(tmp, 'local-addon');
    fs.mkdirSync(addonPath, { recursive: true });

    // Simulate addon entry being directly loadable
    // The loader.loadAddon will be fed addonPath and return a fake addon
    const loadAddon = jest.fn().mockResolvedValue(makeFakeAddon('local-addon'));
    const registerAddon = jest.fn();
    const loader = { loadAddon, registerAddon, getAddonInfo: jest.fn() } as unknown as AddonLoader;
    const registerAddons = jest.fn();
    const hooks = { registerAddons } as unknown as HookManager;
    const saveToRegistry = jest.fn().mockResolvedValue(undefined);
    const registry = { saveToRegistry, removeAddonFromRegistry: jest.fn() } as unknown as AddonRegistry;
    const github = { downloadRepo: jest.fn(), downloadFromUrl: jest.fn() } as unknown as GitHubDownloader;

    const installer = new AddonInstaller(loader, hooks, registry, github, tmp, path.join(tmp, 'global'));

    const opts: InstallOptions = { source: 'local', path: addonPath };
    await installer.installAddon('local-addon', opts);

    expect(registerAddons).toHaveBeenCalled();
    expect(registerAddon).toHaveBeenCalled();
    expect(saveToRegistry).toHaveBeenCalled();
  });

  test('installs from github via downloader', async () => {
    const tmp = createTempDir();
    const loadAddon = jest.fn().mockResolvedValue(makeFakeAddon('gh-addon'));
    const registerAddon = jest.fn();
    const loader = { loadAddon, registerAddon, getAddonInfo: jest.fn() } as unknown as AddonLoader;
    const registerAddons = jest.fn();
    const hooks = { registerAddons } as unknown as HookManager;
    const saveToRegistry = jest.fn().mockResolvedValue(undefined);
    const registry = { saveToRegistry, removeAddonFromRegistry: jest.fn() } as unknown as AddonRegistry;
    const downloadRepo = jest.fn().mockResolvedValue(undefined);
    const github = { downloadRepo, downloadFromUrl: jest.fn().mockResolvedValue(undefined) } as unknown as GitHubDownloader;

    const installer = new AddonInstaller(loader, hooks, registry, github, tmp, path.join(tmp, 'global'));

    await installer.installAddon('gh-addon', { source: 'github', path: 'user/repo@main' });

    expect(downloadRepo).toHaveBeenCalled();
    expect(registerAddon).toHaveBeenCalled();
    expect(saveToRegistry).toHaveBeenCalled();
  });

  test('uninstall removes registry entry', async () => {
    const tmp = createTempDir();
    const unloadAddon = jest.fn();
    const loader = { unloadAddon, loadAddon: jest.fn(), registerAddon: jest.fn(), getAddonInfo: jest.fn() } as unknown as AddonLoader;
    const hooks = { registerAddons: jest.fn() } as unknown as HookManager;
    const removeAddonFromRegistry = jest.fn().mockResolvedValue(undefined);
    const registry = { saveToRegistry: jest.fn(), removeAddonFromRegistry } as unknown as AddonRegistry;
    const github = { downloadRepo: jest.fn(), downloadFromUrl: jest.fn() } as unknown as GitHubDownloader;

    const addonDir = path.join(tmp, 'gh-addon');
    fs.mkdirSync(addonDir, { recursive: true });

    const installer = new AddonInstaller(loader, hooks, registry, github, tmp, path.join(tmp, 'global'));
    await installer.uninstallAddon('gh-addon', false);

    expect(unloadAddon).toHaveBeenCalledWith('gh-addon');
    expect(removeAddonFromRegistry).toHaveBeenCalledWith('gh-addon');
  });
});
