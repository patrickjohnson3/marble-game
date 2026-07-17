import js from "@eslint/js";

export default [
  {
    ignores: ["node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        clearTimeout: "readonly",
        console: "readonly",
        document: "readonly",
        globalThis: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        performance: "readonly",
        process: "readonly",
        requestAnimationFrame: "readonly",
        screen: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];
