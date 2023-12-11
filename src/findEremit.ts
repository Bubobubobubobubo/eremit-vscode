// @ts-ignord
import * as vscode from "vscode";
import * as child_process from "child_process";


export const appendEremitPath = (path: string): string => {
  /**
   * Appends "/eremit" to the given path if it doesn't already end with it.
   * @param path - The path to append "/sardine" to.
   * @returns The modified path.
   */
  return path.endsWith("/eremit") ? path : path + "/eremit";
};

export const findEremit = (): string | undefined => {
  /**
   * Finds the path to the Eremit executable.
   *
   * @returns The path to the Eremit executable, or undefined if not found.
   */
  const config = vscode.workspace.getConfiguration("eremit");
  const eremitPath = config.get<string>("eremitPath");

  if (eremitPath) {
    return appendEremitPath(eremitPath);
  }

  if (process.platform === "linux" || process.platform === "darwin") {
    try {
      const whichEremit = child_process
        .execSync("which eremit")
        .toString()
        .trim();
      if (whichEremit) {
        return whichEremit;
      }
    } catch (error) {
      if (eremitPath) return appendEremitPath(eremitPath);
    }
  }
  vscode.window.showErrorMessage(
    "Please enter a valid Eremit Path in configuration and restart VSCode"
  );
  return undefined;
};
