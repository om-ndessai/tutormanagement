// ESLint (flat config): Expo's rules plus the bans that keep the app inside the portal's rules.
// See apps/mobile/CLAUDE.md. scripts/check-mobile-rules.mjs enforces the textual ones.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'src/theme/palettes.generated.ts'] },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='printToFileAsync']",
          message:
            'printToFileAsync writes a PDF to disk; the 1099 carries an SSN. Use Print.printAsync({ html }).',
        },
        {
          selector: "ImportSpecifier[imported.name='printToFileAsync']",
          message:
            'printToFileAsync writes a PDF to disk; the 1099 carries an SSN. Use Print.printAsync({ html }).',
        },
      ],
    },
  },
]);
