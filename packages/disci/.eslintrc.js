module.exports = {
    root: true,
    extends: ["custom"],
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.eslint.json', './packages/*/tsconfig.json'],
    },
};