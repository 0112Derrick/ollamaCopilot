import * as vscode from "vscode";
import { llama3, defaultURLChat } from "./external/ollama";
import { WebViewProvider } from "./providers/webViewProvider";
import completionProvider from "./providers/completionProvider";
import {
  inlineSuggestionProvider,
  promptForModel,
  promptForOllamaHeaders,
  promptForOllamaURLChat,
} from "./scripts";
import { COMMANDS } from "./utils";
import InlineCompletionProvider from "./providers/inlineCompletionProvider";

export async function activate(context: vscode.ExtensionContext) {
  const webview = new WebViewProvider(context);

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
    })
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("ollamaView", webview)
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "*",
      completionProvider,
      COMMANDS.aiResponseMenuTrigger
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.clearWebviewChats", () => {
      webview.clearWebviewChats();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.getMoreInfo", () => {
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
          webview.promptAI(
            "Tell me about the following code/text: " + selectedText
          );
        } else {
          vscode.window.showInformationMessage("No text selected.");
        }
      } else {
        vscode.window.showErrorMessage("No active editor found.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.improveTheCode", () => {
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
          webview.promptAI("Improve this code: " + selectedText);
        } else {
          vscode.window.showInformationMessage("No text selected.");
        }
      } else {
        vscode.window.showErrorMessage("No active editor found.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.refactorCode", () => {
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
          webview.promptAI("Refactor this code: " + selectedText);
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
        { language: "javascriptreact" },
        { language: "typescriptreact" },
      ],
      /*  { pattern: "**" }, // Applies to all files, adjust the pattern if needed */
      InlineCompletionProvider // Create an instance of the provider class
    );

  context.subscriptions.push(inlineCompletionProvider);

  let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const change = event.contentChanges[0];

    const model = context.globalState.get<string>("ollamaModel", llama3.name);

    // const isOpenAiModel = context.globalState.get<boolean>(
    //   "openAiModel",
    //   false
    // );

    const ollamaHeaders = context.globalState.get<string>(
      "ollamaHeaders",
      "{}"
    );

    const ollamaUrlChat = context.globalState.get<string>(
      "ollamaURLChat",
      defaultURLChat
    );

    const checkAndInsertSuggestion = async () => {
      //ANCHOR - Check for AI commands
      try {
        const document = editor.document;
        const position = editor.selection.active;

        const line = document.lineAt(position.line);
        const lineText = line.text.trim();
        const languageId = document.languageId;

        if (!lineText.includes(COMMANDS.aiTrigger)) {
          if (inlineSuggestionProvider.getCodingLanguage() !== languageId) {
            inlineSuggestionProvider.setCodingLanguage(languageId);
          }

          //ANCHOR - Check code for autocompletion areas.
          inlineSuggestionProvider.triggerQueryAI(
            model,
            ollamaUrlChat,
            ollamaHeaders,
            document,
            lineText ? lineText : undefined,
            lineText ? position.line : undefined
          );
        }
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
          change.text === " " ||
          change.text.endsWith(";") || // Optional: check for semicolon
          change.text.endsWith("{") || // Optional: check for opening brace
          change.text.endsWith("}") || // Optional: check for closing brace;
          change.text.endsWith("=") // Optional: check for equal sign;
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
}

export function deactivate() {}
