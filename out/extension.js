"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const findEremit_1 = require("./findEremit");
const vscode_1 = require("vscode");
const child_process_1 = require("child_process");
// Eremit CLI process
let eremitProc;
// Eremit Status bar
let eremitStatus;
// Eremit output channels
let eremitOutput;
// Styles
let feedbackStyle;
let outputHooks = new Map();
var FeedbackStyle;
(function (FeedbackStyle) {
    FeedbackStyle[FeedbackStyle["outputChannel"] = 0] = "outputChannel";
    FeedbackStyle[FeedbackStyle["infomationMessage"] = 1] = "infomationMessage";
})(FeedbackStyle || (FeedbackStyle = {}));
function activate(context) {
    /**
     * Activates the extension (entry point).
     *
     * @param context The extension context.
     */
    let commands = new Map([
        ["eremit.start", start],
        ["eremit.send", send],
        ["eremit.silence", silence],
        ["eremit.panic", panic],
        ["eremit.sendSelections", sendSelections],
        ["eremit.stop", stop],
    ]);
    for (const [key, func] of commands)
        context.subscriptions.push(vscode.commands.registerTextEditorCommand(key, func));
}
exports.activate = activate;
function deactivate() {
    /**
     * Deactivates the extension.
     */
    stop();
}
exports.deactivate = deactivate;
const silence = () => {
    /**
     * Writes "silence()" to the standard input of the sardineProc.
     */
    eremitProc.stdin.write("silence()\n\n");
};
const panic = () => {
    /**
     * Writes "panic()" to the standard input of the sardineProc.
     */
    eremitProc.stdin.write("panic()\n\n");
};
const setupStatus = () => {
    /**
     * Sets up the status bar item for the Sardine plugin.
     */
    eremitStatus = vscode.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 10);
    eremitStatus.text = "$(triangle-right) Eremit";
    eremitStatus.tooltip = "Click to open Eremit documentation";
    eremitStatus.command = "extension.openEremitDocs";
    eremitStatus.show();
};
const setupOutput = () => {
    /**
     * Sets up the output channel for Eremit.
     */
    eremitOutput = vscode.window.createOutputChannel("Eremit");
    eremitOutput.show(true);
};
const start = (editor) => {
    /**
     * Starts the Eremit extension.
     *
     * @param editor The TextEditor instance representing the active editor.
     * @returns A Promise that resolves when the Eremit  extension has started
     * successfully, or rejects with an error if there was an issue starting
     * the extension.
     */
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        // Kill any process named "eremit" that is running
        // exec('pkill -f "python.*sardine"', (error, stdout, stderr) => {
        //   if (error) {
        //     console.error(`exec error: ${error}`);
        //     return;
        //   }
        //   console.log(`stdout: ${stdout}`);
        //   console.error(`stderr: ${stderr}`);
        // });
        var _a, _b;
        try {
            if (eremitProc && !eremitProc.killed) {
                eremitProc.kill();
                // Kill any process named "sardine" that is running
            }
            let config = vscode.workspace.getConfiguration("eremit");
            vscode.languages.setTextDocumentLanguage(editor.document, "lua");
            feedbackStyle = config.get("feedbackStyle") || FeedbackStyle.outputChannel;
            let eremitPath = (0, findEremit_1.findEremit)();
            if (!eremitPath) {
                vscode.window.showInformationMessage(`Can't start without Eremit path.`);
                reject(new Error("Eremit path not defined"));
                return;
            }
            eremitProc = (0, child_process_1.spawn)(eremitPath, [], {
                env: Object.assign({}, process.env),
            });
            let sardineProcID = eremitProc.pid;
            eremitProc.on("spawn", () => {
                console.log("Sardine process started.");
            });
            eremitProc.on("exit", (code) => {
                eremitProc.kill("SIGINT");
                console.log(`Eremit process exited with code ${code}`);
            });
            eremitProc.on("error", (err) => {
                vscode.window.showErrorMessage(`Eremit error: ${err.message}`);
                reject(err);
            });
            (_a = eremitProc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
                printFeedback(data.toString());
                resolve();
            });
            (_b = eremitProc.stderr) === null || _b === void 0 ? void 0 : _b.on("data", (data) => {
                printFeedback(data.toString());
                resolve();
            });
            setupStatus();
            setupOutput();
            vscode.window.showInformationMessage(`Sardine has started with: ${eremitPath}`);
        }
        catch (error) {
            reject(error);
        }
    }));
};
const printFeedback = (message) => {
    /**
     * Prints the feedback message with type indication.
     * @param message - The feedback message to be printed.
     * @param type - The type of the message ('stdout' or 'stderr').
     */
    // const strippedMessage = stripAnsi(message);
    switch (feedbackStyle) {
        case FeedbackStyle.infomationMessage:
            vscode.window.showInformationMessage(message);
            break;
        default:
            eremitOutput.appendLine(message);
            break;
    }
};
const handleOnClose = (code) => {
    /**
     * Handles the onClose event of the Sardine plugin.
     * @param code The exit code of Sardine.
     */
    if (code !== 0) {
        vscode.window.showErrorMessage(`Sardine has exited: ${code}.`);
    }
    else {
        vscode.window.showInformationMessage(`Sardine has stopped.`);
    }
    eremitStatus === null || eremitStatus === void 0 ? void 0 : eremitStatus.dispose();
};
const stop = () => {
    // Kill the Sardine process
    if (eremitProc && !eremitProc.killed) {
        eremitProc.kill();
    }
    // Dispose the status bar item
    if (eremitStatus) {
        eremitStatus.dispose();
    }
    // Clear the output channel
    if (eremitOutput) {
        eremitOutput.clear();
    }
    // Show a message to the user
    vscode.window.showInformationMessage('Eremit has stopped.');
};
const selectCursorsContexts = (editor) => {
    /**
     * Modifies the selections in the editor to include additional context lines.
     * The context lines are determined by including non-empty and non-whitespace
     * lines * above and below the original selection range.
     *
     * @param editor The TextEditor instance representing the editor.
     */
    editor.selections = editor.selections.map((s) => {
        let [d, sl, el] = [editor.document, s.start.line, s.end.line];
        let r = d.lineAt(sl).range.union(d.lineAt(el).range);
        for (let l = sl; l >= 0 && !d.lineAt(l).isEmptyOrWhitespace; l--)
            r = r.union(d.lineAt(l).range);
        for (let l = el; l < d.lineCount && !d.lineAt(l).isEmptyOrWhitespace; l++)
            r = r.union(d.lineAt(l).range);
        return new vscode_1.Selection(r.start, r.end);
    });
};
const send = (editor) => __awaiter(void 0, void 0, void 0, function* () {
    /**
     * Sends the selected text to Eremit for processing.
     * If Eremit is not running, it will be started first.
     * @param editor The text editor containing the selected text.
     */
    if (!eremitProc || eremitProc.killed) {
        console.log("Eremit is not running, starting it...");
        yield start(editor);
        console.log("Eremit started.");
    }
    selectCursorsContexts(editor);
    yield sendSelections(editor);
});
const sendSelections = (editor) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    /**
     * Sends the selected text from the editor to the Eremit process.
     *
     * @param editor The TextEditor containing the selected text.
     */
    for (const s of editor.selections) {
        let t = editor.document.getText(s);
        try {
            if (!eremitProc || !eremitProc.stdin) {
                throw new Error("Sardine process is not running.");
            }
            printFeedback(">>> " + t);
            (_a = eremitProc.stdin) === null || _a === void 0 ? void 0 : _a.write(t + "\n\n");
            editor.selections = editor.selections.map((s) => new vscode_1.Selection(s.active, s.active));
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error sending selection: ${error.message}`);
            }
            else {
                vscode.window.showErrorMessage(`An unexpected error occurred while sending selections.`);
            }
        }
    }
});
vscode.commands.registerCommand("extension.openEremitDocs", () => {
    /**
     * Opens the Eremit documentation in the default browser.
     */
    vscode.env.openExternal(vscode.Uri.parse("https://google.fr"));
});
//# sourceMappingURL=extension.js.map