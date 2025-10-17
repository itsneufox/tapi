import { AddonRegistry } from '../../../src/core/addons/AddonRegistry';
import { AddonRecovery } from '../../../src/core/addons/AddonRecovery';

describe('AddonRecovery', () => {
  test('records and retrieves addon errors', () => {
    const disableAddonInRegistry = jest.fn();
    const registry = { disableAddonInRegistry } as unknown as AddonRegistry;
    const recovery = new AddonRecovery(registry);

    recovery.recordAddonError('example', 'boom');
    recovery.recordAddonError('example', 'pow');

    expect(recovery.getAddonErrors('example')).toEqual(['boom', 'pow']);

    recovery.clearAddonErrors('example');
    expect(recovery.getAddonErrors('example')).toEqual([]);
  });

  test('attemptAddonRecovery delegates to registry', async () => {
    const disableAddonInRegistry = jest.fn().mockResolvedValue(undefined);
    const registry = { disableAddonInRegistry } as unknown as AddonRegistry;
    const recovery = new AddonRecovery(registry);

    await recovery.attemptAddonRecovery('a1', 'e1');

    expect(disableAddonInRegistry).toHaveBeenCalledWith('a1', 'e1');
  });
});
