import * as vscode from "vscode";
import { llama3, defaultURL } from "./external/ollama";
import { WebviewViewProvider } from "./providers/webViewProvider";
import completionProvider from "./providers/completionProvider";
import {
  backgroundQueryForBoilerPlateCode,
  promptForModel,
  promptForOllamaHeaders,
  promptForOllamaURL,
  queryAiOnUserQueryInTextDoc,
} from "./scripts";
import { COMMANDS } from "./utils";

let lastCheckTime = 0;

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
    vscode.commands.registerCommand("ollama-copilot.setOllamaHeaders", () => {
      promptForOllamaHeaders(context);
    })
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "ollamaView",
      new WebviewViewProvider(context)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "*",
      completionProvider,
      COMMANDS.aiResponseMenuTrigger
    )
  );

  let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    let processedComments = new Set<number>();

    const model = context.globalState.get<string>("ollamaModel", llama3.name);

    const ollamaUrl = context.globalState.get<string>("ollamaURL", defaultURL);

    const ollamaHeaders = context.globalState.get<string>(
      "ollamaHeaders",
      "{}"
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

        const systemPrompt = `System Prompt: Return in string format code that responds to the user query. You will only ever return code and nothing else. Do not respond with any other statements other than the code or code comments. Ensure your answer is correct and only return the best version of your answer. Ensure that you match how the user codes (variables, functions vs objects, loops). Example: Create a variable that says hello world in javascript response: "let helloWorld = 'hello world'"; Respond to the user query in the following language ${
          languageId === "text" ? "typescript" : languageId
        }. User query:`;

        if (
          (lineText.startsWith(COMMANDS.aiTrigger) || lineText === "") &&
          !processedComments.has(position.line)
        ) {
          if (position.line < 0 || position.line >= document.lineCount) {
            console.error(`Invalid line number: ${position.line}`);
            return;
          }

          processedComments.add(position.line);
          const newPosition = editor.selection.active;

          if (newPosition.line < 0 || newPosition.line >= document.lineCount) {
            console.error(`Invalid new position line: ${newPosition.line}`);
            return;
          }

          const newLine = document.lineAt(newPosition.line);
          const newLineText = newLine.text.trim();

          if (
            newLineText.startsWith(COMMANDS.aiTrigger) &&
            !newLineText.includes(COMMANDS.clearSuggestionsCommand) &&
            !newLineText.includes(COMMANDS.restoreSuggestions)
          ) {
            queryAiOnUserQueryInTextDoc(
              newLine,
              newLineText,
              systemPrompt,
              editor,
              document,
              model,
              ollamaUrl,
              ollamaHeaders
            );
          } else if (newLineText === COMMANDS.clearSuggestionsCommand) {
            //ANCHOR - Clear suggestions
            completionProvider.clearSuggestions();
          } else if (newLineText === COMMANDS.restoreSuggestions) {
            //ANCHOR - Restore suggestions
            completionProvider.restoreSuggestions();
          } else if (
            newLineText === "" &&
            position.line >= lineCount - 2 &&
            document.getText().trim() !== ""
          ) {
            //ANCHOR - Check for boiler plate code.
            backgroundQueryForBoilerPlateCode(
              lastCheckTime,
              model,
              ollamaUrl,
              ollamaHeaders,
              document
            );
          }
        }
      } catch (e) {
        console.error("Error: ", e);
      }
    };

    if (
      event.contentChanges.some((change) => {
        console.log("change in doc: " + change.text);
        console.log(
          `New line: ${change.text.trim() === "\n" ? "true" : "false"}`
        );
        return change.text.includes("\n");
      })
    ) {
      checkAndInsertSuggestion();
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
