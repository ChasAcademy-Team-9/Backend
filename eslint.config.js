// eslint.config.js
export default [
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "module",
            globals: {
                // Node.js globals
                process: "readonly",
                __dirname: "readonly",
                module: "readonly",
                require: "readonly"
            }
        },
        rules: {
            indent: ["error", 4],
            quotes: ["error", "double"],
            semi: ["error", "always"]
        }
    }
];
