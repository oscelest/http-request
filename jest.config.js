module.exports = {
  roots:              ["<rootDir>/test"],
  testMatch:          [
    "**/*.test.(ts|tsx|js|jsx)",
  ],
  transform:          {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  globals:            {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
  setupFilesAfterEnv: [
    "./test/Setup.ts",
  ],
  testTimeout:        15000,
};
