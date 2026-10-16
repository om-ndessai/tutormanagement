// Metro for an isolated Expo app beside an npm-workspaces monorepo.
//
// apps/mobile is NOT a workspace (Expo pins its own React; see docs/mobile/README.md). It takes
// @tmi/shared as a symlink to packages/shared, whose sources Metro must watch and transpile.
// A bare import made FROM the shared sources (`zod`) is resolved as if made from this app, so
// it finds apps/mobile/node_modules and never the monorepo root's copy: one zod, one React.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../../packages/shared');
const appOrigin = path.join(projectRoot, 'package.json');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

// Maestro writes its reports -- screenshots, view hierarchies, 100 MB of device log per flow -- into
// .maestro/out while a flow runs. Watched, every file it wrote made Metro's watcher fire mid-flow,
// and on iOS that cost a step its effect: a Close tapped while a run was writing its report got no
// "Discard changes?" and a Back got no pop (people/tutor-view, shell/surface-kit; build log #49).
// Nothing in there is source, so Metro neither crawls nor watches it.
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reports = new RegExp(`^${escape(path.join(projectRoot, '.maestro', 'out'))}\\/.*`);
const blocked = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(blocked) ? blocked : blocked ? [blocked] : []), reports];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (context.originModulePath.startsWith(sharedRoot)) {
    // packages/shared imports its siblings as './users.js' (TypeScript's ESM convention) while
    // the files are .ts: try the .ts file first.
    if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
      try {
        return resolve(context, moduleName.replace(/\.js$/, '.ts'), platform);
      } catch {
        // fall through to the module as written
      }
    } else if (!moduleName.startsWith('.') && !path.isAbsolute(moduleName)) {
      return resolve({ ...context, originModulePath: appOrigin }, moduleName, platform);
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
