import * as vscode from "vscode";
import {
  llama3,
  defaultURLChatCompletion,
  defaultURLChat,
} from "./external/ollama";
import { WebViewProvider } from "./providers/webViewProvider";
import completionProvider from "./providers/completionProvider";
import {
  backgroundQueryForBoilerPlateCode,
  promptForModel,
  promptForOllamaHeaders,
  promptForOllamaURLChat,
  queryAiOnUserQueryInTextDoc,
} from "./scripts";
import { COMMANDS } from "./utils";
import InlineCompletionProvider from "./providers/inlineCompletionProvider";

let lastCheckTime = 0;

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
    })
  );
  //  package.json
  // {
  //         "command": "ollama-copilot.setURL",
  //         "title": "Set Ollama URL"
  //       },
  // context.subscriptions.push(
  //   vscode.commands.registerCommand("ollama-copilot.setURL", () => {
  //     promptForOllamaURL(context);
  //   })
  // );

  context.subscriptions.push(
    vscode.commands.registerCommand("ollama-copilot.setOllamaHeaders", () => {
      promptForOllamaHeaders(context);
    })
  );

  context.subscriptions.push(
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
      //FIXME - update the webview with this prompt.
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
      //FIXME - update the webview with this prompt.
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
      //FIXME - update the webview with this prompt.
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
      { pattern: "**" }, // Applies to all files, adjust the pattern if needed
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
        const lineCount = document.lineCount;

        const line = document.lineAt(position.line);
        const lineText = line.text.trim();
        const languageId = document.languageId;

        const systemPrompt = `Return in string format code that responds to the user query. You will only ever return code and nothing else. Do not respond with any other statements other than the code or code comments. If you do make comments make sure to wrap the comment in block comments e.g: /* comment */. Ensure your answer is correct and only return the best version of your answer. Ensure that you match how the user codes (variables, functions vs objects, loops).`;

        if (!lineText.includes(COMMANDS.aiTrigger)) {
          //ANCHOR - Check for boiler plate code.
          backgroundQueryForBoilerPlateCode(
            lastCheckTime,
            model,
            ollamaUrlChat,
            ollamaHeaders,
            document
          );
        }
      } catch (e) {
        console.error("error: ", e);
      }
    };

    //     if (
    //       (lineText.startsWith(COMMANDS.aiTrigger) || lineText === "") &&
    //       !processedComments.has(position.line)
    //     ) {
    //       if (position.line < 0 || position.line >= document.lineCount) {
    //         console.error(`Invalid line number: ${position.line}`);
    //         vscode.window.showErrorMessage(
    //           `An error occurred: Invalid line number: ${position.line}`
    //         );
    //         return;
    //       }

    //       processedComments.add(position.line);
    //       const newPosition = editor.selection.active;

    //       if (newPosition.line < 0 || newPosition.line >= document.lineCount) {
    //         console.error(`Invalid new position line: ${newPosition.line}`);
    //         vscode.window.showErrorMessage(
    //           `An error occurred: Invalid new position line: ${newPosition.line}`
    //         );
    //         return;
    //       }

    //       const newLine = document.lineAt(newPosition.line);
    //       const newLineText = newLine.text.trim();

    //       if (
    //         newLineText.startsWith(COMMANDS.aiTrigger) &&
    //         !newLineText.includes(COMMANDS.clearSuggestionsCommand) &&
    //         !newLineText.includes(COMMANDS.restoreSuggestions)
    //       ) {
    //         queryAiOnUserQueryInTextDoc(
    //           newLine,
    //           newLineText,
    //           systemPrompt,
    //           editor,
    //           document,
    //           model,
    //           ollamaUrlChat,
    //           ollamaHeaders,
    //           `${languageId === "text" ? "typescript" : languageId}.`
    //         );
    //       } else if (newLineText === COMMANDS.clearSuggestionsCommand) {
    //         //ANCHOR - Clear suggestions
    //         completionProvider.clearSuggestions();
    //       } else if (newLineText === COMMANDS.restoreSuggestions) {
    //         //ANCHOR - Restore suggestions
    //         completionProvider.restoreSuggestions();
    //       } else {
    //         //ANCHOR - Check for boiler plate code.
    //         backgroundQueryForBoilerPlateCode(
    //           lastCheckTime,
    //           model,
    //           ollamaUrlChat,
    //           ollamaHeaders,
    //           document
    //         );

    //         /* if (
    //         newLineText === "" &&
    //         position.line >= lineCount - 2 &&
    //         document.getText().trim() !== ""
    //       )  */
    //       }
    //     }
    //   } catch (e) {
    //     console.error("Error: ", e);
    //     vscode.window.showErrorMessage("An error occurred: " + e);
    //   }
    // };

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
          change.text.includes("\n") ||
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
