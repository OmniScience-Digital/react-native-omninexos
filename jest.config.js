// jest.config.js
// Lets `npx jest` run the tests in /__tests__ (Expo preset + the "@/" import alias used across the app).
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
};
