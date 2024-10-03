import * as vscode from "vscode";
import { llama3, defaultURLChat } from "./external/ollama";
import { WebViewProvider } from "./providers/webViewProvider";
import fs from "fs/promises";
import {
  startingActivationCharacters,
  endingActivationCharacters,
  supportedLanguages,
  supportedLanguagesExtensions,
} from "./constants/directories";

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
import {
  analyzeWorkspaceDocuments,
  checkForTestingPackages,
  getWorkSpaceId,
} from "./utils/workspace";
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

    let useEmbedding = false;

    if (ollamaEmbedURL && ollamaEmbedModel && useEmbedding) {
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
              for (let supportedExtension of supportedLanguagesExtensions) {
                if (file.fsPath.endsWith(supportedExtension)) {
                  // Read the content of the newly created file
                  const fileContent = await fs.readFile(file.fsPath, "utf8");
                  if (fileContent.trim() === "") {
                    return;
                  }
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
                  break;
                }
              }
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
        }
        vscode.window.showInformationMessage("Embedding workspace successful.");
        console.log("Data saved to workspaceState");
      } else {
        console.warn("No data to save from index.json");
      }
    }

    const webview = new WebViewProvider(
      context,
      vectorDB ? (vectorDB as VectorDatabase) : null
    );

    const inlineSuggestionProvider = new inlineAiSuggestionsProvider(
      vectorDB ? (vectorDB as VectorDatabase) : null
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
          (vectorDB as VectorDatabase).clearIndex();
        }
      }),
      vscode.commands.registerCommand(
        "ollama-copilot.clearAllSavedState",
        () => {
          clearAllWorkspaceState(context, webview);
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
          await vscode.commands.executeCommand("ollamaView.focus");
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
      vscode.commands.registerCommand(
        "ollama-copilot.writeAUnitTest",
        async () => {
          const result = await checkForTestingPackages();
          let prompt = "";
          let path = getWorkSpaceId().activeDocument;

          if (result) {
            prompt += `Write a unit test for the following function using this unit testing library: ${result}; File path ${path}; Function: `;
          } else {
            prompt += `File path:${path}; Write unit tests for this function: `;
          }
          // let prompt = "Write unit tests for this function: ";
          promptModelWithPreWrittenQuery(prompt);
        }
      ),
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

            await (vectorDB as VectorDatabase).addItemToVectorStore(
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

    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        supportedLanguages,
        InlineCompletionProvider
      )
    );

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
            context,
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
        let supportedDocument = false;
        if (!vectorDB || !doc.activeDocument) {
          return;
        }

        for (let extension of supportedLanguagesExtensions) {
          if (doc.activeDocument.endsWith(extension)) {
            supportedDocument = true;
            break;
          }
        }

        if (
          supportedDocument &&
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

                const vectors = await (
                  vectorDB as VectorDatabase
                ).saveWorkspace();
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
                      await (vectorDB as VectorDatabase).deleteItem(item.id);
                    });
                  }

                  (vectorDB as VectorDatabase).addItemToVectorStore(
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

      event.contentChanges.some((change) => {
        const position = editor.selection.active;
        const document = editor.document;
        const line = document.lineAt(position.line);
        const lineText = line.text.trim();

        const doc = getWorkSpaceId();
        let supportedDocument = false;

        if (!doc.activeDocument) {
          return;
        }

        for (let extension of supportedLanguagesExtensions) {
          if (doc.activeDocument.endsWith(extension)) {
            supportedDocument = true;
            break;
          }
        }

        //Prevents the extension from prompting the LLM while the user is typing in an unsupported document.
        if (!supportedDocument) {
          return;
        }

        //Checks for inline prompts to the model.
        if (change.text === "\n" && lineText.startsWith("//")) {
          vscode.window.showInformationMessage("Processing.");
          checkAndInsertSuggestion();
        }

        //Checks if the change begins with or ends with an activation character.
        for (let activationCharacter of startingActivationCharacters) {
          if (change.text.startsWith(activationCharacter)) {
            checkAndInsertSuggestion();
            return;
          }
        }

        for (let activationCharacter of endingActivationCharacters) {
          if (change.text.endsWith(activationCharacter)) {
            checkAndInsertSuggestion();
            return;
          }
        }
      });
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
