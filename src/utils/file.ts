import fs from "fs";
import path from "path";
import chokidar, { type FSWatcher } from "chokidar";
import logger from "./logger";
import Constants from "../constants";

export type filePath = keyof typeof Constants.paths;

const resolve = (key: filePath) => path.resolve(Constants.paths[key]);

export default class FileModule {
  static ensureDir(dir: string = Constants.paths.HOME) {
    fs.mkdirSync(dir, { recursive: true });
  }

  static exists(key: filePath) {
    return fs.existsSync(resolve(key));
  }

  /** Returns undefined for a missing file instead of creating it. */
  static read(key: filePath): string | undefined {
    try {
      return fs.readFileSync(resolve(key), "utf8");
    } catch (error: any) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
  }

  /** Write to a temp file and rename, so readers never see a half-written file. */
  static writeAtomic(key: filePath, data: string) {
    const target = resolve(key);
    FileModule.ensureDir(path.dirname(target));
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, data, "utf8");
    fs.renameSync(tmp, target);
  }

  static write(key: filePath, data: string) {
    const target = resolve(key);
    FileModule.ensureDir(path.dirname(target));
    fs.writeFileSync(target, data, "utf8");
  }

  static remove(key: filePath) {
    fs.rmSync(resolve(key), { force: true });
  }

  static appendStream(key: filePath) {
    const target = resolve(key);
    FileModule.ensureDir(path.dirname(target));
    return fs.createWriteStream(target, { flags: "a" });
  }

  static watch(key: filePath, onChange: () => void): FSWatcher {
    const target = resolve(key);
    FileModule.ensureDir(path.dirname(target));
    // Watch the directory: atomic writes replace the file's inode, which a
    // plain file watch can miss on some platforms.
    const watcher = chokidar.watch(path.dirname(target), {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    });
    watcher
      .on("all", (_event, changed) => {
        if (path.resolve(changed) !== target) return;
        try {
          onChange();
        } catch (error) {
          logger.error(error);
        }
      })
      .on("error", (error) => logger.error(`Watcher error: ${error}`));
    return watcher;
  }

  static tailFile(key: filePath, maxLines = 20) {
    const target = resolve(key);
    FileModule.ensureDir(path.dirname(target));
    if (!fs.existsSync(target)) fs.writeFileSync(target, "", "utf8");

    const lines = fs.readFileSync(target, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length) process.stdout.write(lines.slice(-maxLines).join("\n") + "\n");

    let lastKnownSize = fs.statSync(target).size;
    const watcher = FileModule.watch(key, () => {
      const currentSize = fs.existsSync(target) ? fs.statSync(target).size : 0;
      if (currentSize > lastKnownSize) {
        fs.createReadStream(target, {
          start: lastKnownSize,
          end: currentSize - 1,
          encoding: "utf8",
        }).on("data", (chunk) => process.stdout.write(chunk));
      } else if (currentSize < lastKnownSize) {
        process.stdout.write("\n--- log truncated or rotated ---\n");
      }
      lastKnownSize = currentSize;
    });

    const stop = () => {
      watcher.close().finally(() => process.exit(0));
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }

  static lastLines(key: filePath, count: number) {
    return (FileModule.read(key) || "").split(/\r?\n/).filter(Boolean).slice(-count);
  }
}
