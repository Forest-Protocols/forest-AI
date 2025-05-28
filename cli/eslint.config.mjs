import baseConfig from "../../eslint.config.mjs";

export default [
  ...baseConfig,
  {
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
