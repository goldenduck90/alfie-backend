module.exports = {
  "**/*.{js,ts}": [
    () => "npm run tsc",
    () => "npm run format:fix",
    () => "npm run lint:fix",
    () => "npm run test --forceExit --json"
  ],
  "**/*.{css,md,json}": [() => "npm run format:fix"],
}
