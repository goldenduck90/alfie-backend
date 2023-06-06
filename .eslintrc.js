module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["@typescript-eslint"],
  env: {
    browser: true,
    es2020: true,
  },
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 11,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  rules: {
    "prettier/prettier": 0,
    "semi": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/semi": ["warn", "never"],
    "quotes": "off",
    "@typescript-eslint/quotes": ["warn", "double"],
    "@typescript-eslint/no-unused-vars": ["warn"],
    "@typescript-eslint/member-delimiter-style": [
      "warn",
      {
        multiline: {
          delimiter: "none",
        },
        singleline: {
          delimiter: "semi",
          requireLast: false,
        },
      },
    ],
    "no-shadow": "off",
    "@typescript-eslint/no-shadow": ["error"],
    "no-throw-literal": "error",
    "no-undef": "off",
    "prefer-arrow-callback": ["warn", { allowNamedFunctions: false }],
    "no-warning-comments": ["warn", { terms: ["xxx"] }],
    "comma-dangle": [
      "warn",
      {
        arrays: "always-multiline",
        objects: "always-multiline",
        imports: "always-multiline",
        exports: "always-multiline",
        functions: "never",
      },
    ],
    "no-empty": ["warn"],
    "no-empty-function": ["warn"],
  },
}
