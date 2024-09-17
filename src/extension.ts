import * as vscode from "vscode";
import { llama3, defaultURLChat } from "./external/ollama";
import { WebViewProvider } from "./providers/webViewProvider";
import fs from "fs/promises";

import {
  clearAllWorkspaceState,
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
import path from "path";
import { VectorDatabase } from "./scripts/interfaces";

export async function activate(context: vscode.ExtensionContext) {
  try {
    const model = context.globalState.get<string>($keys.OLLAMA_MODEL);
    const ollamaUrlChatCompletion = context.globalState.get<string>(
      $keys.OLLAMA_CHAT_COMPLETION_URL
    );
    const ollamaEmbedURL = context.globalState.get($keys.OLLAMA_EMBED_URL);
    const ollamaEmbedModel = context.globalState.get($keys.OLLAMA_EMBED_MODEL);

    //detect if the user has a model setup.
    if (model === undefined || ollamaUrlChatCompletion === undefined) {
      await setupOllama(context);
    }

    console.log("Initializing VectraDB...");
    let vectorDB: VectraDB | null = null;

    getWorkSpaceId();

    if (ollamaEmbedURL && ollamaEmbedModel) {
      vectorDB = new VectraDB(context);
      console.log("Creating index...");

      await vectorDB.createIndex();

      const indexData: string | undefined = await context.workspaceState.get(
        $keys.VECTOR_DATABASE_KEY
      );

      // console.log("Workspace saved vector data: ", indexData);

      if (!indexData) {
        vscode.window.showInformationMessage("Embedding data.");
        await vectorDB.indexWorkspaceDocuments();
        saveVectorDBToWorkspaceState();

        const documents = await analyzeWorkspaceDocuments();
        if (documents) {
          context.workspaceState.update(
            $keys.WORKSPACE_DOCUMENTS_KEY,
            JSON.stringify(documents)
          );
        }
      } else {
        await vectorDB.clearIndex();
        let data = JSON.parse(indexData);
        vscode.window.showInformationMessage("Loaded embedded data.");
        vectorDB.loadWorkSpace(data);
      }

      const fileRenameListener = vscode.workspace.onDidRenameFiles(
        async (event) => {
          console.log(
            "New file name: ",
            event.files[0].newUri.fsPath,
            " Prev name: ",
            event.files[0].oldUri.fsPath
          );
          if (!vectorDB) {
            return;
          }
          const vectors = await vectorDB.saveWorkspace();
          if (!vectors) {
            return;
          }
          const updatedVectors = vectors.items.map((vect) => {
            if (vect.metadata.filePath === event.files[0].oldUri.fsPath) {
              console.log(
                "Updating filepaths in vector database: ",
                vect.metadata.filePath
              );
              vect.metadata.filePath = event.files[0].newUri.fsPath;
              console.log(
                "Changed filepaths to: ",
                event.files[0].newUri.fsPath
              );
            }
            return vect;
          });

          const result = await vectorDB.updateItems(updatedVectors);
          result
            ? vscode.window.showInformationMessage(
                "Successfully updated vectors matching changed filename."
              )
            : vscode.window.showErrorMessage(
                "Unable to update vectors matching changed filename."
              );
        }
      );

      const workspaceChangeListener =
        vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
          if (!vectorDB) {
            return;
          }
          vectorDB.clearIndex();

          console.log("Creating index...");
          await vectorDB.createIndex();

          const indexData: string | undefined =
            await context.workspaceState.get($keys.VECTOR_DATABASE_KEY);

          console.log("Workspace saved vector data: ", indexData);

          if (!indexData) {
            await vectorDB.indexWorkspaceDocuments();
            saveVectorDBToWorkspaceState();

            const documents = await analyzeWorkspaceDocuments();
            if (documents) {
              context.workspaceState.update(
                $keys.WORKSPACE_DOCUMENTS_KEY,
                JSON.stringify(documents)
              );
            }
          } else {
            await vectorDB.clearIndex();
            let data = JSON.parse(indexData);
            vectorDB.loadWorkSpace(data);
          }
        });

      // Listen for file creation
      const fileCreationListener = vscode.workspace.onDidCreateFiles(
        async (event) => {
          for (const file of event.files) {
            try {
              if (!vectorDB) {
                return;
              }
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
      const fileDeletionListener = vscode.workspace.onDidDeleteFiles(
        (event) => {
          event.files.forEach(async (file) => {
            if (!vectorDB) {
              return;
            }
            vscode.window.showInformationMessage(
              `File deleted: ${file.fsPath}`
            );

            console.log(`File deleted at path: ${file.fsPath}`);

            const vector = await vectorDB.saveWorkspace();
            if (!vector) {
              return;
            }

            if (vector && vector.items) {
              console.log("Initial len: ", vector.items.length);
              const updatedVectors = vector.items.filter((vector) => {
                return vector.metadata.filePath !== file.fsPath; // Return boolean
              });
              console.log("Final len: ", updatedVectors.length);

              vectorDB.updateItems(updatedVectors);

              saveVectorDBToWorkspaceState();
            }
          });
        }
      );

      context.subscriptions.push(
        fileCreationListener,
        fileDeletionListener,
        fileRenameListener,
        workspaceChangeListener
      );
    }

    async function saveVectorDBToWorkspaceState() {
      if (!vectorDB) {
        return;
      }

      const data = await vectorDB.saveWorkspace();
      if (data) {
        await context.workspaceState.update(
          $keys.VECTOR_DATABASE_KEY,
          JSON.stringify(data)
        );

        let savedWorkspaces: string[] = JSON.parse(
          context.globalState.get($keys.SAVED_WORKSPACES_KEY, "[]")
        );

        const currentWorkspace = getWorkSpaceId().workspaceId;

        if (
          savedWorkspaces &&
          Array.isArray(savedWorkspaces) &&
          currentWorkspace
        ) {
          if (!savedWorkspaces.includes(currentWorkspace)) {
            savedWorkspaces.push(currentWorkspace);

            await context.globalState.update(
              $keys.SAVED_WORKSPACES_KEY,
              JSON.stringify(savedWorkspaces)
            );
          }
          vscode.window.showInformationMessage(
            "Added current workspace to tracked workspaces."
          );
        }
        vscode.window.showInformationMessage("Embedding workspace successful.");
        console.log("Data saved to workspaceState");
      } else {
        console.warn("No data to save from index.json");
      }
    }

    const webview = new WebViewProvider(context, vectorDB as VectorDatabase);

    const inlineSuggestionProvider = new inlineAiSuggestionsProvider(
      vectorDB as VectorDatabase
    );

    if (vectorDB) {
      webview.updateVectorDatabase(vectorDB as VectorDatabase);
    }

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
        if (vectorDB) {
          vectorDB.clearIndex();
        }
      }),
      vscode.commands.registerCommand(
        "ollama-copilot.clearAllSavedState",
        () => {
          clearAllWorkspaceState(context, webview);
        }
      ),
      vscode.commands.registerCommand(
        "ollama-copilot.seeSimilarQueries",
        async () => {
          const query = await vscode.window.showInputBox({
            prompt: "Enter query.",
            value: "",
          });

          if (vectorDB && query) {
            console.log("result: ", vectorDB.getSimilarQueries(query));
          }
        }
      ),
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

    const promptModelWithPreWrittenQuery = async (prompt: string) => {
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
          await vscode.commands.executeCommand("ollamaView.focus");
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
        if (editor && vectorDB) {
          // Get the selected text
          const selection = editor.selection;
          const selectedText = editor.document.getText(selection);

          if (selectedText) {
            vscode.window.showInformationMessage(
              `Selected text: ${selectedText}`
            );
            let id = getWorkSpaceId();

            await vectorDB.addItemToVectorStore(
              selectedText,
              id.activeDocument ? id.activeDocument : ""
            );

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

    let lastCheckedDoc = "";
    let lastCheckTime = 0;

    let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const change = event.contentChanges[0];

      const checkAndInsertSuggestion = async () => {
        try {
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
      const checkAndEmbedDocuments = async () => {
        const doc = getWorkSpaceId();
        const currentTime = Date.now();
        if (!vectorDB) {
          return;
        }

        if (
          doc.activeDocument &&
          (lastCheckedDoc !== doc.activeDocument ||
            lastCheckTime + 30000 < currentTime)
        ) {
          lastCheckedDoc = doc.activeDocument;
          lastCheckTime = currentTime;
          // Read file content and count lines
          try {
            const docs = context.workspaceState.get(
              $keys.WORKSPACE_DOCUMENTS_KEY,
              "[]"
            );

            if (docs) {
              const documents = JSON.parse(docs) as {
                documentName: string;
                lineCount: number;
              }[];

              if (!documents) {
                return;
              }

              const fileContent = await fs.readFile(doc.activeDocument, "utf8");
              const lineCount = fileContent.split("\n").length;
              let currentDoc = documents?.find(
                (_doc) => _doc.documentName === doc.activeDocument
              );
              console.log(
                "Checking doc line count; prev:",
                currentDoc?.lineCount,
                " current: ",
                lineCount
              );
              if (currentDoc && currentDoc.lineCount + 50 < lineCount) {
                console.log(
                  `Updating embedding document file: ${currentDoc.documentName}`
                );

                const vectors = await vectorDB.saveWorkspace();
                if (vectors) {
                  // Normalize paths for consistent comparison
                  const currentDocPath = path.normalize(
                    currentDoc.documentName
                  );

                  const updatedVectors = vectors.items.filter((vec) => {
                    const vecFilePath = path.normalize(
                      vec.metadata.filePath as string
                    );

                    return vecFilePath === currentDocPath;
                  });

                  console.log(
                    "Files with matching paths: ",
                    updatedVectors.length
                  );
                  if (updatedVectors) {
                    updatedVectors.forEach(async (item) => {
                      await vectorDB.deleteItem(item.id);
                    });
                  }

                  vectorDB.addItemToVectorStore(
                    fileContent,
                    currentDoc.documentName
                  );
                  saveVectorDBToWorkspaceState();
                }
              }
            }
          } catch (e) {
            console.error(
              "An error occurred while reading active document content."
            );
          }
        }
      };
      checkAndEmbedDocuments();

      if (
        event.contentChanges.some((change) => {
          return (
            change.text.endsWith(".") ||
            change.text.endsWith("[") ||
            change.text.endsWith("]") ||
            change.text.endsWith(":") ||
            change.text.endsWith(";") ||
            change.text.endsWith("{") ||
            change.text.endsWith("}") ||
            change.text.endsWith("=") ||
            change.text.endsWith("for") ||
            change.text.endsWith("=>") ||
            change.text.startsWith("class") ||
            change.text.startsWith("def") ||
            change.text.startsWith("function") ||
            change.text.startsWith("let") ||
            change.text.startsWith("const") ||
            change.text.startsWith("int") ||
            change.text.startsWith("boolean") ||
            change.text.startsWith("struct") ||
            change.text.startsWith("long") ||
            change.text.startsWith("short") ||
            change.text.startsWith("float") ||
            change.text.startsWith("double") ||
            change.text.startsWith("string") ||
            change.text.startsWith("new")
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
