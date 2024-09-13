import * as vscode from "vscode";
import { llama3, defaultURLChat } from "./external/ollama";
import { WebViewProvider } from "./providers/webViewProvider";
import fs from "fs/promises";

import {
  promptForClearWorkspaceEmbeddedData,
  promptForModel,
  promptForOllamaHeaders,
  promptForOllamaURLChat,
  resetStoredValues,
  setupOllama,
} from "./scripts";

import InlineCompletionProvider from "./providers/inlineCompletionProvider";
import { inlineAiSuggestionsProvider } from "./providers/inlineSuggestionsProvider";
import { analyzeWorkspaceDocuments, getWorkSpaceId } from "./utils/workspace";
import { LOCAL_STORAGE_KEYS as $keys } from "./constants/LocalStorageKeys";
import VectraDB from "./db/vectorDB";

export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log("Initializing VectraDB...");
    const vectorDB = new VectraDB(context);

    console.log("Creating index...");
    await vectorDB.createIndex();

    const webview = new WebViewProvider(context, vectorDB);
    const indexData: string | undefined = await context.workspaceState.get(
      $keys.VECTOR_DATABASE_KEY
    );

    console.log("Workspace saved vector data: ", indexData);

    async function saveVectorDBToWorkspaceState() {
      const data = vectorDB.readEmbeddingsFile();
      if (data) {
        await context.workspaceState.update(
          $keys.VECTOR_DATABASE_KEY,
          JSON.stringify(data)
        );
        console.log("Data saved to workspaceState");
      } else {
        console.warn("No data to save from index.json");
      }
    }

    if (!indexData) {
      await vectorDB.indexWorkspaceDocuments();
      saveVectorDBToWorkspaceState();
    } else {
      vectorDB.clearEmbeddingsFile();
      let data = JSON.parse(indexData);
      vectorDB.writeEmbeddingsFile(data);
    }

    const documents = await analyzeWorkspaceDocuments();
    if (documents) {
      console.log(`Total documents: ${documents.length}`);
      documents.forEach((doc) => {
        console.log("Document Name: ", doc.documentName);
      });
    }

    // Listen for file creation
    const fileCreationListener = vscode.workspace.onDidCreateFiles(
      async (event) => {
        for (const file of event.files) {
          try {
            // Read the content of the newly created file
            const fileContent = await fs.readFile(file.fsPath, "utf8");

            // Count the number of lines
            const lineCount = fileContent.split("\n").length;

            // Show line count information
            vscode.window.showInformationMessage(
              `Embedding new file: ${file.fsPath}.`
            );
            console.log(
              `File created at path: ${file.fsPath} with ${lineCount} lines.`
            );

            vectorDB.addItemToVectorStore(fileContent, file.fsPath);

            saveVectorDBToWorkspaceState();
          } catch (error) {
            vscode.window.showErrorMessage(
              `Error reading file ${file.fsPath}: ${error}`
            );
            console.error(`Error reading file ${file.fsPath}:`, error);
          }
        }
      }
    );

    //Listen for file deletion
    const fileDeletionListener = vscode.workspace.onDidDeleteFiles((event) => {
      event.files.forEach((file) => {
        vscode.window.showInformationMessage(`File deleted: ${file.fsPath}`);
        console.log(`File deleted at path: ${file.fsPath}`);
        const vector = vectorDB.readEmbeddingsFile();
        console.log("Type of vector: ", typeof vector?.items);

        if (vector && vector.items && Array.isArray(vector.items)) {
          console.log("Starting len: ", vector.items.length);
          const updatedVectors = vector.items.filter((vector) => {
            return vector.metadata.filePath !== file.fsPath; // Return boolean
          });

          console.log(updatedVectors.length);
          let updatedVectorObj = { ...vector, items: updatedVectors };
          vectorDB.writeEmbeddingsFile(updatedVectorObj);
          saveVectorDBToWorkspaceState();
        }
        // You can add your logic here to handle the deleted file
      });
    });

    context.subscriptions.push(fileCreationListener, fileDeletionListener);

    const inlineSuggestionProvider = new inlineAiSuggestionsProvider(vectorDB);

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "yourExtension.clearInlineSuggestion",
        () => {
          InlineCompletionProvider.clearSuggestionOnEscape();
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("ollama-copilot.setModel", () => {
        promptForModel(context);
      }),
      vscode.commands.registerCommand("ollama-copilot.setOllamaHeaders", () => {
        promptForOllamaHeaders(context);
      }),
      vscode.commands.registerCommand("ollama-copilot.setURL_WebView", () => {
        promptForOllamaURLChat(context);
      }),
      vscode.commands.registerCommand("ollama-copilot.clearEmbedData", () => {
        promptForClearWorkspaceEmbeddedData(context);
        vectorDB.clearEmbeddingsFile();
      }),
      vscode.commands.registerCommand(
        "ollama-copilot.resetStoredValues",
        () => {
          resetStoredValues(context);
        }
      )
    );

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider("ollamaView", webview)
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "ollama-copilot.clearWebviewChats",
        () => {
          webview.clearWebviewChats();
        }
      )
    );

    const promptModelWithPreWrittenQuery = (prompt: string) => {
      /* 
      1. Check for selected text.
      2. Prompt AI for more info about the text.
      3. Push the response to the webview with the user message being more info about the selected text.
      */

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // Get the selected text
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (selectedText) {
          vscode.window.showInformationMessage(
            `Selected text: ${selectedText}`
          );
          webview.promptAI(prompt + selectedText);
        } else {
          vscode.window.showInformationMessage("No text selected.");
        }
      } else {
        vscode.window.showErrorMessage("No active editor found.");
      }
    };

    context.subscriptions.push(
      vscode.commands.registerCommand("ollama-copilot.getMoreInfo", () => {
        promptModelWithPreWrittenQuery(
          "Tell me about the following code/text: "
        );
      }),
      vscode.commands.registerCommand("ollama-copilot.designPattern", () => {
        promptModelWithPreWrittenQuery(
          "What is the best design pattern for this use case? "
        );
      }),
      vscode.commands.registerCommand("ollama-copilot.writeAUnitTest", () => {
        promptModelWithPreWrittenQuery(
          "Write a unit tests for this function: "
        );
      }),
      vscode.commands.registerCommand("ollama-copilot.debugTheCode", () => {
        promptModelWithPreWrittenQuery("Debug this code: ");
      }),
      vscode.commands.registerCommand("ollama-copilot.improveTheCode", () => {
        promptModelWithPreWrittenQuery("Improve this code: ");
      }),
      vscode.commands.registerCommand("ollama-copilot.refactorCode", () => {
        promptModelWithPreWrittenQuery("Refactor this code: ");
      }),
      vscode.commands.registerCommand("ollama-copilot.embedCode", async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          // Get the selected text
          const selection = editor.selection;
          const selectedText = editor.document.getText(selection);

          if (selectedText) {
            vscode.window.showInformationMessage(
              `Selected text: ${selectedText}`
            );
            let id = getWorkSpaceId();

            await vectorDB.addItemToVectorStore(selectedText, id ? id : "");

            saveVectorDBToWorkspaceState();
          } else {
            vscode.window.showInformationMessage("No text selected.");
          }
        } else {
          vscode.window.showErrorMessage("No active editor found.");
        }
      })
    );

    const inlineCompletionProvider =
      vscode.languages.registerInlineCompletionItemProvider(
        [
          { language: "javascript" },
          { language: "typescript" },
          { language: "python" },
          { language: "java" },
          { language: "c" },
          { language: "cpp" },
          { language: "csharp" },
          { language: "go" },
          { language: "ruby" },
          { language: "php" },
          { language: "swift" },
          { language: "kotlin" },
          { language: "rust" },
          { language: "html" },
          { language: "css" },
          { language: "sass-indented" },
          { language: "scss" },
          { language: "less" },
          { language: "stylus" },
          { language: "handlebars" },
          { language: "javascriptreact" },
          { language: "typescriptreact" },
          { language: "vue" },
        ],
        /*  { pattern: "**" }, // Applies to all files, adjust the pattern if needed */
        InlineCompletionProvider // Create an instance of the provider class
      );

    context.subscriptions.push(inlineCompletionProvider);

    const model = context.globalState.get<string>("ollamaModel");
    if (model === undefined) {
      await setupOllama(context);
    }

    let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const change = event.contentChanges[0];

      const model = context.globalState.get<string>(
        $keys.OLLAMA_MODEL,
        llama3.name
      );

      const ollamaHeaders = context.globalState.get<string>(
        $keys.OLLAMA_HEADERS,
        "{}"
      );

      const ollamaUrlChatCompletion = context.globalState.get<string>(
        $keys.OLLAMA_CHAT_COMPLETION_URL,
        defaultURLChat
      );

      const checkAndInsertSuggestion = async () => {
        try {
          const document = editor.document;
          const position = editor.selection.active;

          const line = document.lineAt(position.line);
          const lineText = line.text.trim();
          const languageId = document.languageId;

          if (inlineSuggestionProvider.getCodingLanguage() !== languageId) {
            inlineSuggestionProvider.setCodingLanguage(languageId);
          }

          //ANCHOR - Check code for autocompletion areas.
          inlineSuggestionProvider.triggerQueryAI(
            model,
            ollamaUrlChatCompletion,
            ollamaHeaders,
            document,
            lineText ? lineText : undefined
          );
        } catch (e) {
          console.error("error: ", e);
        }
      };

      if (change) {
        // Check if the suggestion was accepted
        const userAcceptChange = InlineCompletionProvider.wasSuggestionAccepted(
          change.text
        );
        // console.log("Was change accepted: ", userAcceptChange);
        if (userAcceptChange) {
          // console.log("Suggestion accepted:", change.text);
          InlineCompletionProvider.showNextSuggestion();
        }
      }

      if (
        event.contentChanges.some((change) => {
          return (
            change.text.startsWith("//") ||
            change.text.startsWith("class") ||
            change.text.endsWith("[") ||
            change.text.endsWith("]") ||
            change.text.endsWith(":") ||
            change.text.endsWith(";") || // Optional: check for semicolon
            change.text.endsWith("{") || // Optional: check for opening brace
            change.text.endsWith("}") || // Optional: check for closing brace;
            change.text.endsWith("=") || // Optional: check for equal sign;
            change.text.endsWith("for") || // Optional: check for equal sign;
            change.text.endsWith("=>") || // Optional: check for equal sign;
            change.text.startsWith("def") || // Optional: check for equal sign;
            change.text.startsWith("function") // Optional: check for equal sign;
          );
        })
      ) {
        checkAndInsertSuggestion();
      }
    });

    // Track when the active text editor changes
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor) {
          // console.log("Active editor changed, clearing suggestion if needed.");
          InlineCompletionProvider.clearInlineSuggestion();
        }
      }
    );

    context.subscriptions.push(disposable, editorChangeDisposable);
  } catch (e) {
    console.error("An error occurred during extension activation: ", e);
    if (e instanceof Error) {
      console.error("Error message:", e.message);
      console.error("Error stack:", e.stack);
    }
    vscode.window.showErrorMessage(`Extension activation failed: ${e}`);
  }
}

export function deactivate() {}
