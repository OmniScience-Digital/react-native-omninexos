// plugins/withGradleMemory.js
//
// Raises the Gradle / Kotlin daemon memory limits for Android builds.
// The Expo default caps Metaspace at 512 MB, and the KSP step of expo-updates
// can run out ("java.lang.OutOfMemoryError: Metaspace") as more native
// modules are added.
const { withGradleProperties } = require("expo/config-plugins");

const SETTINGS = {
  "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1536m",
  "kotlin.daemon.jvmargs": "-Xmx3072m -XX:MaxMetaspaceSize=1536m",
};

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(SETTINGS)) {
      const existing = cfg.modResults.find(
        (p) => p.type === "property" && p.key === key,
      );
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: "property", key, value });
    }
    return cfg;
  });
};
