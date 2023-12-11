"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEremit = exports.appendEremitPath = void 0;
// @ts-ignord
const vscode = require("vscode");
const child_process = require("child_process");
const appendEremitPath = (path) => {
    /**
     * Appends "/eremit" to the given path if it doesn't already end with it.
     * @param path - The path to append "/sardine" to.
     * @returns The modified path.
     */
    return path.endsWith("/eremit") ? path : path + "/eremit";
};
exports.appendEremitPath = appendEremitPath;
const findEremit = () => {
    /**
     * Finds the path to the Eremit executable.
     *
     * @returns The path to the Eremit executable, or undefined if not found.
     */
    const config = vscode.workspace.getConfiguration("eremit");
    const eremitPath = config.get("eremitPath");
    if (eremitPath) {
        return (0, exports.appendEremitPath)(eremitPath);
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
        }
        catch (error) {
            if (eremitPath)
                return (0, exports.appendEremitPath)(eremitPath);
        }
    }
    vscode.window.showErrorMessage("Please enter a valid Eremit Path in configuration and restart VSCode");
    return undefined;
};
exports.findEremit = findEremit;
//# sourceMappingURL=findEremit.js.map