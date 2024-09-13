const esbuild = require("esbuild");
const fs = require("fs-extra");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log("[watch] build finished");
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyGpt3EncoderFiles = {
  name: "copy-gpt3-encoder-files",
  setup(build) {
    build.onEnd(() => {
      const sourceDir = path.join(__dirname, "node_modules", "gpt-3-encoder");
      const targetDir = path.join(__dirname, "dist");

      ["encoder.json", "vocab.bpe"].forEach((file) => {
        fs.copySync(path.join(sourceDir, file), path.join(targetDir, file), {
          overwrite: true,
        });
      });

      console.log("Copied gpt-3-encoder files to dist directory");
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/**/*.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outdir: "dist",
    external: ["vscode", "process", "fs", "path"],
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin, copyGpt3EncoderFiles],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
