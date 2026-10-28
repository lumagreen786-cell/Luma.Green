const DEFAULT_APP_URL = "https://luma.green";
// eslint-disable-next-line sonarjs/no-hardcoded-ip -- Android emulator loopback is restricted to explicit development
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "10.0.2.2"]);

function appOrigin(value = DEFAULT_APP_URL, isLocalHttpAllowed = false) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_URL must be an origin without credentials, a path, a query or a fragment.",
    );
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(isLocalHttpAllowed && isLocal && url.protocol === "http:")
  ) {
    throw new Error(
      "APP_URL requires HTTPS. Explicit development mode permits local HTTP only.",
    );
  }
  if (isLocal && !isLocalHttpAllowed)
    throw new Error("Local app origins are development-only.");
  return url.origin;
}

module.exports = { DEFAULT_APP_URL, appOrigin };
