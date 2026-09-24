/**
 * Chạy test cho engine gọi AI.
 *
 * `src/lib` import theo kiểu bundler (không có đuôi file) nên Node ESM không
 * resolve được trực tiếp. Script này bundle bộ test bằng esbuild — vốn đã có sẵn
 * trong node_modules qua Vite — rồi chạy bằng `node:test`, nhờ đó không cần thêm
 * dependency nào cho việc test.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
// Liệt kê tường minh để không phụ thuộc glob của shell; thêm bộ test mới thì thêm vào đây.
const testFiles = [
  resolve(root, "src/lib/callbot.test.ts"),
  resolve(root, "src/lib/store.test.tsx"),
  resolve(root, "src/lib/speech.test.ts"),
  resolve(root, "src/lib/voiceApi.test.ts"),
];

const outDir = mkdtempSync(join(tmpdir(), "callio-test-"));
const outFiles = [];

try {
  const esbuild = resolve(root, "node_modules/.bin/esbuild");

  for (const [index, testFile] of testFiles.entries()) {
    const outFile = join(outDir, `suite-${index}.mjs`);
    const build = spawnSync(
      esbuild,
      [testFile, "--bundle", "--platform=node", "--format=esm", `--outfile=${outFile}`, "--log-level=warning"],
      { stdio: "inherit" },
    );

    if (build.status !== 0) {
      console.error(`Bundle thất bại: ${testFile}`);
      process.exit(build.status ?? 1);
    }

    outFiles.push(outFile);
  }

  const run = spawnSync(process.execPath, ["--test", ...outFiles], { stdio: "inherit" });
  process.exit(run.status ?? 1);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
