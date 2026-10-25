// Phase 53: the AimTrue-Test build -- the production app pointed at the test Worker.
type Config = { name: string; scheme: string; icon: string; ios: { bundleIdentifier: string }; android: { package: string }; extra: Record<string, unknown>; plugins: unknown[] };

function configFor(variant: string): Config {
  const saved = process.env.APP_VARIANT;
  process.env.APP_VARIANT = variant;
  try {
    let built: Config | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const make = require('../../app.config').default as (ctx: { config: object }) => Config;
      built = make({ config: {} });
    });
    return built!;
  } finally {
    process.env.APP_VARIANT = saved;
  }
}

describe('the test variant (AimTrue-Test)', () => {
  const test = configFor('test');

  it('is its own app, never mistaken for the real one', () => {
    expect(test.name).toBe('AimTrue-Test');
    expect(test.ios.bundleIdentifier).toBe('com.aimtrue.app.test');
    expect(test.android.package).toBe('com.aimtrue.app.test');
    expect(test.scheme).toBe('aimtrue-test');
    expect(test.icon).toContain('icon-test');
  });

  it('behaves as production at runtime, against the test Worker', () => {
    expect(test.extra.variant).toBe('production');
    expect(test.extra.buildVariant).toBe('test');
    expect(test.extra.productionApiUrl).toBe('https://tutoring-test.tmi-api.workers.dev');
  });

  it('leaves the production app as it was', () => {
    const production = configFor('production');
    expect(production.name).toBe('Aimtrue');
    expect(production.scheme).toBe('aimtrue');
    expect(production.extra.productionApiUrl).not.toContain('tutoring-test');
  });
});
