// Jest on Node with the jest-expo preset. The shared package lives outside this folder (a
// symlink to packages/shared), so it is transformed too, and its `zod` resolves to this app's.
const path = require('node:path');

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-paper|react-native-svg|@tmi/shared|@tanstack/.*))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^zod$': path.join(__dirname, 'node_modules/zod'),
    '^@babel/runtime/(.*)$': path.join(__dirname, 'node_modules/@babel/runtime/$1'),
    // packages/shared imports siblings as './x.js'; the sources are .ts.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.maestro/'],
};
