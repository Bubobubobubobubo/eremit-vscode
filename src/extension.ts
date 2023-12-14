import * as vscode from "vscode";
import { findEremit } from "./findEremit";
import {
  TextEditor,
  Selection,
  StatusBarItem,
  StatusBarAlignment,
  OutputChannel,
} from "vscode";
import { spawn, ChildProcess, exec } from "child_process";
import * as child_process from "child_process";

// Eremit CLI process
let eremitProc: ChildProcess;

// Eremit Status bar
let eremitStatus: StatusBarItem;

// Eremit output channels
let eremitOutput: OutputChannel;

// Styles
let feedbackStyle: FeedbackStyle;
let outputHooks: Map<string, (s: string) => any> = new Map();

enum FeedbackStyle {
  outputChannel,
  infomationMessage,
}


export function activate(context: vscode.ExtensionContext) {
  /**
   * Activates the extension (entry point).
   *
   * @param context The extension context.
   */
  let commands = new Map<string, (...args: any[]) => any>([
    ["eremit.start", start],
    ["eremit.send", send],
    ["eremit.silence", silence],
    ["eremit.panic", panic],
    ["eremit.sendSelections", sendSelections],
    ["eremit.stop", stop],
  ]);

  for (const [key, func] of commands)
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(key, func)
    );
}

export function deactivate() {
  /**
   * Deactivates the extension.
   */
  stop();
}

const silence = () => {
  /**
   * Writes "silence()" to the standard input of the eremitProc.
   */
  eremitProc.stdin!.write("silence()");
};

const panic = () => {
  /**
   * Writes "panic()" to the standard input of the eremitProc.
   */
  eremitProc.stdin!.write("panic()");
};

const setupStatus = () => {
  /**
   * Sets up the status bar item for the Eremit plugin.
   */
  eremitStatus = vscode.window.createStatusBarItem(
    StatusBarAlignment.Left,
    10
  );
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

const start = (editor: TextEditor): Promise<void> => {
  /**
   * Starts the Eremit extension. 
   *
   * @param editor The TextEditor instance representing the active editor.
   * @returns A Promise that resolves when the Eremit  extension has started 
   * successfully, or rejects with an error if there was an issue starting 
   * the extension.
   */
  return new Promise(async (resolve, reject) => {

    // Kill any process named "eremit" that is running
    // exec('pkill -f "python.*sardine"', (error, stdout, stderr) => {
    //   if (error) {
    //     console.error(`exec error: ${error}`);
    //     return;
    //   }
    //   console.log(`stdout: ${stdout}`);
    //   console.error(`stderr: ${stderr}`);
    // });

    try {
      if (eremitProc && !eremitProc.killed) {
        eremitProc.kill();
        // Kill any process named "eremit" that is running
      }

      let config = vscode.workspace.getConfiguration("eremit");
      vscode.languages.setTextDocumentLanguage(editor.document, "lua");
      feedbackStyle = config.get("feedbackStyle") || FeedbackStyle.outputChannel;
      let eremitPath = findEremit();
      if (!eremitPath) {
        vscode.window.showInformationMessage(
          `Can't start without Eremit path.`
        );
        reject(new Error("Eremit path not defined"));
        return;
      }

      eremitProc = spawn(eremitPath, [], {
        env: {
          ...process.env,
        },
      });
      let eremitProcID  = eremitProc.pid;

      eremitProc.on("spawn", () => {
        console.log("Eremit  process started.");
      });

      eremitProc.on("exit", (code) => {
        eremitProc.kill("SIGINT");
        console.log(`Eremit process exited with code ${code}`);
      });

      eremitProc.on("error", (err) => {
        vscode.window.showErrorMessage(`Eremit error: ${err.message}`);
        reject(err);
      });

      eremitProc.stdout?.on("data", (data) => {
        printFeedback(data.toString());
        resolve();
      });

      eremitProc.stderr?.on("data", (data) => {
        printFeedback(data.toString());
        resolve();
      });

      setupStatus();
      setupOutput();
      vscode.window.showInformationMessage(
        `Eremit has started with: ${eremitPath}`
      );
    } catch (error) {
      reject(error);
    }
  });
};

const printFeedback = (message: string) => {
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

const handleOnClose = (code: number) => {
  /**
   * Handles the onClose event of the Eremit plugin.
   * @param code The exit code of Eremit.
   */
  if (code !== 0) {
    vscode.window.showErrorMessage(`Eremit has exited: ${code}.`);
  } else {
    vscode.window.showInformationMessage(`Eremit has stopped.`);
  }
  eremitStatus?.dispose();
};

const stop = () => {
  // Kill the Eremit process
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

const selectCursorsContexts = (editor: TextEditor) => {
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
    return new Selection(r.start, r.end);
  });
};

const send = async (editor: TextEditor) => {
  /**
   * Sends the selected text to Eremit for processing.
   * If Eremit is not running, it will be started first.
   * @param editor The text editor containing the selected text.
   */
  if (!eremitProc || eremitProc.killed) {
    console.log("Eremit is not running, starting it...");
    await start(editor);
    console.log("Eremit started.");
  }
  selectCursorsContexts(editor);
  await sendSelections(editor);
};

const sendSelections = async (editor: TextEditor) => {
  /**
   * Sends the selected text from the editor to the Eremit process.
   *
   * @param editor The TextEditor containing the selected text.
   */
  for (const s of editor.selections) {
    let t = editor.document.getText(s);
    try {
      if (!eremitProc || !eremitProc.stdin) {
        throw new Error("Eremit process is not running.");
      }

      printFeedback("Selection is: " + t);
      eremitProc.stdin?.write(t + "\n");

      editor.selections = editor.selections.map(
        (s) => new Selection(s.active, s.active)
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(
          `Error sending selection: ${error.message}`
        );
      } else {
        vscode.window.showErrorMessage(
          `An unexpected error occurred while sending selections.`
        );
      }
    }
  }
};

vscode.commands.registerCommand("extension.openEremitDocs", () => {
  /**
   * Opens the Eremit documentation in the default browser.
   */
  vscode.env.openExternal(
    vscode.Uri.parse("https://google.fr")
  );
});
