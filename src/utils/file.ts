import fs from "fs";
import path from "path";
import chokidar, { type FSWatcher } from "chokidar";
import logger from "./logger";
import Constants from "../constants";

export type filePath = keyof typeof Constants.paths;

export default class FileModule {
  /**
   * Watches a file: creates folder and file if they do not exist, and listens to changes.
   * @param filePath - Path to the file (relative or absolute)
   * @param onChange - Callback to execute on file change
   * @returns Chokidar watcher instance
   */
  static watchFileWithInit(
    filePath: filePath,
    onChange: () => void
  ): FSWatcher {
    const resolvedPath = path.resolve(Constants.paths[filePath]);
    const folderPath = path.dirname(resolvedPath);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      // logger.info(`Created folder: ${folderPath}`);
    }

    // Ensure file exists
    if (!fs.existsSync(resolvedPath)) {
      fs.writeFileSync(resolvedPath, "", "utf8");
      // logger.info(`Created file: ${resolvedPath}`);
    }

    // Watch the file
    const watcher = chokidar.watch(resolvedPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true,
    });

    watcher
      .on("change", (changedPath) => {
        try {
          if (!fs.existsSync(resolvedPath)) {
            console.log(
              `\n[Info] File ${resolvedPath} no longer exists. Stopping watch.`
            );
            if (watcher) watcher.close();
            return;
          }

          onChange();
        } catch (error) {
          logger.error(error);
        }
      })
      .on("error", (error) => {
        console.error("Watcher error:", error);
        watcher.close();
      });

    return watcher;
  }

  static writeFileStream(filePath: filePath, stream: boolean) {
    const resolvedPath = path.resolve(Constants.paths[filePath]);
    const folderPath = path.dirname(resolvedPath);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      // logger.info(`Created folder: ${folderPath}`);
    }

    // Ensure file exists
    if (!fs.existsSync(resolvedPath)) {
      fs.writeFileSync(resolvedPath, "", "utf8");
      // logger.info(`Created file: ${resolvedPath}`);
    }

    return fs.createWriteStream(resolvedPath, stream ? { flags: "a" } : {});
  }

  static async writeFileSync(filePath: filePath, data: string) {
    const resolvedPath = path.resolve(Constants.paths[filePath]);
    const folderPath = path.dirname(resolvedPath);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      logger.info(`Created folder: ${folderPath}`);
    }
    return fs.writeFileSync(resolvedPath, data, "utf8");
  }

  static async readFileSync(
    filePath: filePath,
    defaultValue: string | undefined | null = ""
  ) {
    const resolvedPath = path.resolve(Constants.paths[filePath]);
    const folderPath = path.dirname(resolvedPath);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      // logger.info(`Created folder: ${folderPath}`);
    }
    if (!fs.existsSync(resolvedPath)) {
      fs.writeFileSync(resolvedPath, defaultValue || "", "utf8");
      // logger.info(`Created file: ${resolvedPath}`);
    }
    return fs.readFileSync(resolvedPath, "utf8");
  }

  static async removeFileSync(filePath: filePath) {
    const resolvedPath = path.resolve(Constants.paths[filePath]);
    const folderPath = path.dirname(resolvedPath);
    if (!fs.existsSync(folderPath)) {
      return;
    }
    if (!fs.existsSync(resolvedPath)) {
      return;
    }
    fs.rmSync(resolvedPath, { force: true, recursive: true });
  }

  static async tailFile(filePathKey: filePath, maxLines = 10) {
    const resolvedPath = path.resolve(Constants.paths[filePathKey]);

    try {
      const initialContent = await this.readFileSync(filePathKey);
      const lines = initialContent.trim().split(/\r?\n/);
      const nonEmptyLines = lines.filter((line) => line.length > 0);
      if (nonEmptyLines.length > 0) {
        const lastNLines = nonEmptyLines.slice(-Math.abs(maxLines)).join("\n");
        if (lastNLines) {
          process.stdout.write(lastNLines + "\n");
        }
      }
    } catch (err) {
      console.error(
        `[Error] Reading initial content from ${resolvedPath}:`,
        err
      );
    }

    let lastKnownSize = 0;
    try {
      lastKnownSize = fs.statSync(resolvedPath).size;
    } catch (err) {
      console.error(
        `[Error] Getting initial size of ${resolvedPath}. Assuming 0. Error:`,
        err
      );
    }

    let watcher: FSWatcher | null = null;

    try {
      watcher = this.watchFileWithInit(filePathKey, () => {
        if (!watcher) return;

        try {
          const stats = fs.statSync(resolvedPath);
          const currentSize = stats.size;

          if (currentSize > lastKnownSize) {
            const stream = fs.createReadStream(resolvedPath, {
              start: lastKnownSize,
              end: currentSize - 1, // end is inclusive for createReadStream
              encoding: "utf8",
            });
            stream.on("data", (chunk) => {
              process.stdout.write(chunk);
            });
            stream.on("error", (readErr) => {
              console.error(
                `[Error] Reading new content from ${resolvedPath}:`,
                readErr
              );
            });
            lastKnownSize = currentSize;
          } else if (currentSize < lastKnownSize) {
            process.stdout.write(
              `\n[Info] --- File ${resolvedPath} truncated or replaced. Tailing from new end. ---\n`
            );
            lastKnownSize = currentSize;
          }
        } catch (err) {
          console.error(
            `[Error] Processing file change for ${resolvedPath}:`,
            err
          );
        }
      });

      const cleanup = (err: string) => {
        console.error(`Tailing file exiting with error: ${err}`);
        watcher?.close();
        process.exit(0);
      };

      process.on("exit", () => cleanup("exit"));
      process.on("SIGINT", () => cleanup("stop"));
      process.on("SIGTERM", () => cleanup("stop"));
      process.on("uncaughtException", () => cleanup("uncaughtException"));

      return {
        stop: () => {
          cleanup("stop");
        },
      };
    } catch (watchSetupError) {
      console.error(
        `[Error] Failed to setup watcher for ${resolvedPath}:`,
        watchSetupError
      );
    }
  }
}
