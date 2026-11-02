// jest/asyncStorageMock.js
// The package's own test mock is `module.exports = mock` (no `.default`), but Amplify loads storage with
// `require("@react-native-async-storage/async-storage")?.default` and throws "Ensure ... is installed and linked"
// when that is missing. This wraps the same mock so both ways of importing work.
const mock = require("@react-native-async-storage/async-storage/jest/async-storage-mock");

module.exports = { __esModule: true, default: mock, ...mock };
