"use strict";
/* import * as vscode from "vscode";
import axios from "axios";

const llama3 = {
  maxToken: 4096,
  name: "llama3",
};

const defaultURL = "http://localhost:11434/api/generate";

async function generateChatCompletion(
  query: string,
  model: string = llama3.name,
  url: string = defaultURL
) {
  try {
    // console.log("url: ", url, " typeof url: ", typeof url);
    // console.log("model: ", model, " typeof model: ", typeof model);

    const data_ = {
      model: model,
      prompt: query,
      stream: false,
    };

    const response = await axios.post(url, data_);

    return response.data.response;
  } catch (error) {
    console.error("Error generating chat completion:", error);
    return "";
  }
}

async function promptForModel(context: vscode.ExtensionContext) {
  const currentModel = context.globalState.get<string>(
    "ollamaModel",
    llama3.name
  );
  const model = await vscode.window.showInputBox({
    prompt: "Enter the Ollama model name",
    value: currentModel,
  });

  if (model) {
    context.globalState.update("ollamaModel", model);
    vscode.window.showInformationMessage(`Ollama model set to: ${model}`);
  }
}

async function promptForOllamaURL(context: vscode.ExtensionContext) {
  const currentURL = context.globalState.get<string>("ollamaURL", defaultURL);
  const ollamaUrl = await vscode.window.showInputBox({
    prompt: "Enter the Ollama URL",
    value: currentURL,
  });

  if (ollamaUrl) {
    context.globalState.update("ollamaURL", ollamaUrl);
    vscode.window.showInformationMessage(`Ollama URL set to: ${ollamaUrl}`);
  }
}

function getWebviewContent() {
  return `
        <!DOCTYPE html>
        <html>
        <body>
            <h1>Hello from Webview!</h1>
            <p>This is a simple Webview example.</p>
        </body>
        </html>
    `;
}

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.setModel", () => {
      promptForModel(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.setURL", () => {
      promptForOllamaURL(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showWebview", () => {
      const panel = vscode.window.createWebviewPanel(
        "sampleWebview",
        "Sample Webview",
        vscode.ViewColumn.One,
        {}
      );

      panel.webview.html = getWebviewContent();
    })
  );

  let processedComments = new Set<number>(); // To track processed comments

  let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    //FIXME - May overflow token limit.
    const prevChat = document.getText();
    const line = document.lineAt(position.line);
    const lineText = line.text.trim();

    if (lineText === "//code" && !processedComments.has(position.line)) {
      processedComments.add(position.line);

      const checkAndInsertSuggestion = async () => {
        const newPosition = editor.selection.active;
        const newLine = document.lineAt(newPosition.line);
        const newLineText = newLine.text.trim();

        if (newLineText.startsWith("//code")) {
          const languageId = document.languageId;

          const model = context.globalState.get<string>(
            "ollamaModel",
            llama3.name
          );

          const ollamaUrl = context.globalState.get<string>(
            "ollamaURL",
            defaultURL
          );

          const aiQuery = `Return in string format code that responds to the user query. You will only ever return code and nothing else. Do not respond with any other statements other than the code or code comments. Ensure your answer is correct and only return the best version of your answer. Ensure that variable names are in camelCase. Example: Create a variable that says hello world in javascript response: "let helloWorld = 'hello world'"; Respond to the user query in the following language ${languageId}. User query:`;

          let aiResponse = "";
          let retry = 3;
          const query =
            aiQuery +
            newLineText.replace("//code", "").trim() +
            "; Previous chat to be used for context only, do not repeat any of the content used in this chat history. Chat history: " +
            prevChat;

          while (retry > 0) {
            // Example when calling generateChatCompletion

            aiResponse = await generateChatCompletion(query, model, ollamaUrl);

            if (typeof aiResponse === "string" && aiResponse.trim() !== "") {
              // If response is a valid string and not empty, break the loop
              break;
            }

            retry--;
            if (retry > 0) {
              // Optionally log or handle retry attempts here
              console.log(`Retrying... Attempts left: ${retry}`);
            } else {
              console.log("ai response: ", aiResponse);
              // If out of retries, handle invalid response
              aiResponse = "// Invalid code response after multiple attempts.";
            }
          }

          if (typeof aiResponse !== "string" || aiResponse.trim() === "") {
            console.log("ai response: ", aiResponse);
            aiResponse = "// Invalid code response";
          }

          editor.edit((editBuilder) => {
            const insertPosition = new vscode.Position(
              newLine.range.end.line + 1,
              0
            );
            editBuilder.insert(
              insertPosition,
              `// Suggestion:\n${aiResponse}\n`
            );

            const nextPosition = new vscode.Position(
              newLine.range.end.line + 2,
              0
            );
            editor.selection = new vscode.Selection(nextPosition, nextPosition);
          });
        }
      };

      const onEnterOrUnfocus = vscode.workspace.onDidChangeTextDocument(
        (event) => {
          if (event.contentChanges.some((change) => change.text === "\n")) {
            checkAndInsertSuggestion();
          }
        }
      );

      context.subscriptions.push(onEnterOrUnfocus);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    const provider = new ColorsViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider));
    context.subscriptions.push(vscode.commands.registerCommand("calicoColors.addColor", () => {
        provider.addColor();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("calicoColors.clearColors", () => {
        provider.clearColors();
    }));
}
class ColorsViewProvider {
    _extensionUri;
    static viewType = "calicoColors.colorsView";
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case "colorSelected": {
                    vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
                    break;
                }
            }
        });
    }
    addColor() {
        if (this._view) {
            this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
            this._view.webview.postMessage({ type: "addColor" });
        }
    }
    clearColors() {
        if (this._view) {
            this._view.webview.postMessage({ type: "clearColors" });
        }
    }
    _getHtmlForWebview(webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.js"));
        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>

				<button class="add-color-button">Add Color</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map