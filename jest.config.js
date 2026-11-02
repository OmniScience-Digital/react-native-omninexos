// jest.config.js
// Lets `npx jest` run the tests in /__tests__ (Expo preset + the "@/" import alias used across the app).
//
// immer (Redux Toolkit), react-redux and uuid (Amplify) are resolved by jest to their browser/ESM builds, which
// jest cannot parse ("Unexpected token 'export'" / "Cannot use import statement"). Pointing them at their
// CommonJS entry fixes it without touching the preset's transform rules.
const cjsEntry = (name) => {
  try {
    return require.resolve(name);
  } catch {
    return null;
  }
};
const cjsMap = {};
for (const name of ["immer", "react-redux", "uuid"]) {
  const entry = cjsEntry(name);
  if (entry) cjsMap[`^${name}$`] = entry;
}

module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    ...cjsMap,
    // Amplify loads AsyncStorage on import and needs a `.default`; see jest/asyncStorageMock.js.
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/jest/asyncStorageMock.js",
    // The real NetInfo starts reachability timers that crash the jest worker; the package ships a mock.
    "^@react-native-community/netinfo$":
      "@react-native-community/netinfo/jest/netinfo-mock.js",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
};
