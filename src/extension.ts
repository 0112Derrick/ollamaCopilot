import * as vscode from "vscode";

import completionProvider from "./providers/completionProvider";
import { generateChatCompletion, llama3, defaultURL } from "./external/ollama";
import { WebviewViewProvider } from "./providers/webViewProvider";

const aiTrigger = "//ai";
const aiResponseMenuTrigger = "/";

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

async function promptForOllamaHeaders(context: vscode.ExtensionContext) {
  const currentHeaders = context.globalState.get<string>("ollamaHeaders", "");
  const ollamaHeaders = await vscode.window.showInputBox({
    prompt:
      "Enter the headers you need to connect with your Ollama server, separated by commas (e.g., api-key:1234, api-key2:4567).",
    value: currentHeaders,
  });

  let headers = ollamaHeaders?.split(",");
  let formattedHeaders: { [k: string]: any } = {};

  if (headers) {
    if (headers.length === 1 && headers[0] === "") {
      context.globalState.update("ollamaHeaders", null);
      vscode.window.showInformationMessage(`Ollama headers cleared.`);
    }
    headers.forEach((header) => {
      let headerKeyPairs = header.split(":");
      let key = headerKeyPairs[0].trim();
      let value = headerKeyPairs[1].trim();

      // Check if the key or value is already wrapped in quotes

      key = `${key.replace(/["'`](.*?)["'`]/g, "$1")}`;

      value = `${value.replace(/["'`](.*?)["'`]/g, "$1")}`;

      formattedHeaders[key] = value;
      //  formattedHeaders.push(`${key}:${value}`);
    });
  }

  //const formattedHeadersString = formattedHeaders.join(", ");
  console.log(JSON.stringify(formattedHeaders, null));

  if (ollamaHeaders) {
    context.globalState.update(
      "ollamaHeaders",
      JSON.stringify(formattedHeaders, null)
    );
    vscode.window.showInformationMessage(
      `Ollama headers set to: ${JSON.stringify(formattedHeaders, null)}`
    );
  }
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
      aiResponseMenuTrigger
    )
  );

  let processedComments = new Set<number>();

  let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;

    const prevChat = document.getText();
    const line = document.lineAt(position.line);
    const lineText = line.text.trim();
    const languageId = document.languageId;
    let lastCheckTime = 0;

    const model = context.globalState.get<string>("ollamaModel", llama3.name);

    const ollamaUrl = context.globalState.get<string>("ollamaURL", defaultURL);

    const ollamaHeaders = context.globalState.get<string>(
      "ollamaHeaders",
      "{}"
    );

    const systemPrompt = `System Prompt: Return in string format code that responds to the user query. You will only ever return code and nothing else. Do not respond with any other statements other than the code or code comments. Ensure your answer is correct and only return the best version of your answer. Ensure that variable names are in camelCase. Example: Create a variable that says hello world in javascript response: "let helloWorld = 'hello world'"; Respond to the user query in the following language ${
      languageId === "text" ? "typescript" : languageId
    }. User query:`;

    if (
      (lineText === aiTrigger || lineText === "") &&
      !processedComments.has(position.line)
    ) {
      processedComments.add(position.line);

      const checkAndInsertSuggestion = async () => {
        const newPosition = editor.selection.active;
        const newLine = document.lineAt(newPosition.line);
        const newLineText = newLine.text.trim();

        if (newLineText.startsWith(aiTrigger)) {
          editor.edit((editBuilder) => {
            const lineRange = new vscode.Range(
              newLine.range.start.line,
              0, // Start at the first character
              newLine.range.start.line,
              newLine.range.end.character // End at the last character of the line
            );

            // Replace the entire line with the desired text
            editBuilder.replace(lineRange, `//Processing...`);

            // Move the cursor to the position after replacing the line
            const nextPosition = new vscode.Position(
              newLine.range.start.line,
              0
            );
            editor.selection = new vscode.Selection(nextPosition, nextPosition);
          });

          let aiResponse = "";
          let retry = 3;
          const query =
            systemPrompt +
            newLineText.replace(aiTrigger, "").trim() +
            "; Previous chat to be used for context only, do not repeat any of the content used in this chat history. Chat history: " +
            prevChat;

          while (retry > 0) {
            aiResponse = await generateChatCompletion(
              query,
              model,
              ollamaUrl,
              JSON.parse(ollamaHeaders)
            );

            if (typeof aiResponse === "string" && aiResponse.trim() !== "") {
              break;
            }

            retry--;
            if (retry > 0) {
              console.log(`\nRetrying... Attempts left: ${retry}`);
            } else {
              console.log("\nError: Ai response: ", aiResponse);
              aiResponse = "//Invalid code response after multiple attempts.";
            }
          }

          console.log("\nAi response: ", aiResponse);

          editor.edit((editBuilder) => {
            const lineRange = new vscode.Range(
              newLine.range.start.line,
              0,
              newLine.range.start.line,
              newLine.range.end.character
            );

            editBuilder.replace(lineRange, "");

            const nextPosition = new vscode.Position(
              newLine.range.start.line,
              0
            );
            editor.selection = new vscode.Selection(nextPosition, nextPosition);
          });

          completionProvider.addNewCompletionItem("Suggestion", aiResponse);
          // Simulates a change in the document to trigger IntelliSense
          await vscode.commands.executeCommand("type", {
            text: aiResponseMenuTrigger,
          });
        } else if (newLineText === "") {
          const currentTime = Date.now();

          // Throttle the AI check to every 25 seconds
          if (currentTime - lastCheckTime < 25000) {
            return;
          }

          lastCheckTime = currentTime;

          const aiResponse: string = await generateChatCompletion(
            systemPrompt +
              `Does the code in the document look like boiler plate code? Document: ${document.getText()}. If it is boiler plate code finish then the code for the user code: *The finished boiler plate code goes here. Make an intelligent guess at what they are likely to type next. Do not send any code that exists in the document to the user. Do not repeat anything thats in the document. If you do not know what the user is likely to type next then respond with isBoilerPlateCode:"null" code:"null". If the code is not boiler plate then respond with isBoilerPlateCode:"null" code:"null". Err on the side of sending isBoilerPlateCode:"null" code:"null" if it doesn't explicitly look like boiler plate code.`,
            model,
            ollamaUrl,
            JSON.parse(ollamaHeaders)
          );
          console.log(aiResponse);

          if (
            (aiResponse && aiResponse.trim() !== "null") ||
            !aiResponse.trim().includes("isBoilerPlateCode: string = 'null'")
          ) {
            completionProvider.addNewCompletionItem(
              "Code suggestion:",
              aiResponse
            );

            await vscode.commands.executeCommand("type", {
              text: aiResponseMenuTrigger,
            });
          }
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
