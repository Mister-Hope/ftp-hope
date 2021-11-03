const { resolve } = require("path");

module.exports = {
  rootDir: resolve(__dirname),
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.json",
    },
  },
  testMatch: ["<rootDir>/__tests__/**/*.spec.ts"],
};
