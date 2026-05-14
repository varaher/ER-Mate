const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const blockList = [];
if (config.resolver && config.resolver.blockList) {
  const existing = config.resolver.blockList;
  if (Array.isArray(existing)) blockList.push(...existing);
  else blockList.push(existing);
}
blockList.push(
  new RegExp(
    path.join(__dirname, "\\.local").replace(/[\\/]/g, "[\\\\/]") + ".*"
  )
);
config.resolver = config.resolver || {};
config.resolver.blockList = blockList;

module.exports = config;
