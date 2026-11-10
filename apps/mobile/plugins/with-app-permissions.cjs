const { withInfoPlist } = require("expo/config-plugins");

/** Remove descriptions for capabilities the shell never uses. */
function trimIosPermissions(plist, isDevelopment, areRemindersEnabled = false) {
  const blocked = new Set([
    "NSLocationAlwaysUsageDescription",
    ...(areRemindersEnabled
      ? []
      : ["NSLocationAlwaysAndWhenInUseUsageDescription"]),
    "NSMotionUsageDescription",
    "NSMicrophoneUsageDescription",
    ...(isDevelopment
      ? []
      : ["NSLocalNetworkUsageDescription", "NSBonjourServices"]),
  ]);
  const next = Object.fromEntries(
    Object.entries(plist).filter(([key]) => !blocked.has(key)),
  );
  if (Array.isArray(next.UIBackgroundModes)) {
    next.UIBackgroundModes = next.UIBackgroundModes.filter(
      (mode) =>
        (mode !== "location" || areRemindersEnabled) &&
        mode !== "audio" &&
        mode !== "remote-notification" &&
        mode !== "fetch",
    );
    if (next.UIBackgroundModes.length === 0) delete next.UIBackgroundModes;
  }
  return next;
}

function withAppPermissions(
  config,
  { isDevelopment = false, areRemindersEnabled = false } = {},
) {
  return withInfoPlist(config, (mod) => ({
    ...mod,
    modResults: trimIosPermissions(
      mod.modResults,
      isDevelopment,
      areRemindersEnabled,
    ),
  }));
}
module.exports = withAppPermissions;
module.exports.trimIosPermissions = trimIosPermissions;
