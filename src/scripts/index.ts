import * as vscode from "vscode";
import { generateChatCompletion, llama3, defaultURL } from "../external/ollama";
import completionProvider from "../providers/completionProvider";
import { COMMANDS, isValidJson } from "../utils";
import exp from "constants";

export const queryAiOnUserQueryInTextDoc = async (
  newLine: vscode.TextLine,
  newLineText: string,
  systemPrompt: string,
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  model: string,
  ollamaUrl: string,
  ollamaHeaders: string
) => {
  const prevChat = document.getText();

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
    const nextPosition = new vscode.Position(newLine.range.start.line, 0);
    editor.selection = new vscode.Selection(nextPosition, nextPosition);
  });

  let aiResponse = "";
  let retry = 3;
  const query =
    systemPrompt +
    newLineText.replace(COMMANDS.aiTrigger, "").trim() +
    "; Previous chat to be used for context only, do not repeat any of the content used in this chat history. Chat history: " +
    prevChat;

  while (retry > 0) {
    aiResponse = (
      (await generateChatCompletion(
        query,
        model,
        ollamaUrl,
        JSON.parse(ollamaHeaders)
      )) as string
    ).replaceAll("```", "");

    if (typeof aiResponse === "string" && aiResponse.trim() !== "") {
      break;
    }

    retry--;
    if (retry > 0) {
      console.log(`\nRetrying... Attempts left: ${retry}\n`);
    } else {
      console.log("\nError: Ai response: ", aiResponse);
      aiResponse = "//Invalid code response after multiple attempts.";
    }
  }

  if (typeof aiResponse !== "string" || aiResponse.trim() === "") {
    aiResponse = "Unable to connect to ollama.";
  }

  const updatedLine = editor.document.lineAt(newLine.range.start.line);
  const updatedLineRange = updatedLine.range;

  editor.edit((editBuilder) => {
    editBuilder.replace(updatedLineRange, "");

    const nextPosition = new vscode.Position(newLine.range.start.line, 0);
    editor.selection = new vscode.Selection(nextPosition, nextPosition);
  });

  completionProvider.addNewCompletionItem("Suggestion", aiResponse);
  // Simulates a change in the document to trigger IntelliSense
  await vscode.commands.executeCommand("type", {
    text: COMMANDS.aiResponseMenuTrigger,
  });
};

export const backgroundQueryForBoilerPlateCode = async (
  lastCheckTime: number,
  model: string,
  ollamaUrl: string,
  ollamaHeaders: string,
  document: vscode.TextDocument
) => {
  console.log("Checking doc for boiler plate code.");

  const currentTime = Date.now();

  console.log(
    `ct:${currentTime} lt:${lastCheckTime} result: ${
      currentTime - lastCheckTime < 25000
    }`
  );

  // Throttle the AI check to every 25 seconds
  if (currentTime - lastCheckTime < 25000) {
    return;
  }

  lastCheckTime = currentTime;

  let aiResponse: { isBoilerPlateCode: boolean; code: string } = {
    isBoilerPlateCode: false,
    code: "",
  };

  let retry = 3;
  const query = `Does the code in the document look like boiler plate code? document: ${document.getText()}. If it is boiler plate code then send json in the following format: {"isBoilerPlateCode": true,"code":"insert the finished boiler plate code here. Match how the user codes and do not include any new feature, code that exists in the document already, and if the user has a class that already exists do not retype it in your response. Keep your code clean and concise with code comments."}. In all other cases send back json like this: {"isBoilerPlateCode": false, "code": ""}. Do not send any code that already exists in the document (If you wish to make a change to an existing class or function send a code comment e.g: {"isBoilerPlateCode": true, "code": "//change class X to add in Y property" }. Only send JSON.)`;

  while (retry > 0) {
    let response = await generateChatCompletion(
      query,
      model,
      ollamaUrl,
      JSON.parse(ollamaHeaders)
    );
    console.log(
      `\npre-parse response: ${response}  type: ${typeof response}\n`
    );

    // Validate if the response is a valid JSON
    if (isValidJson(response)) {
      response = JSON.parse(response);

      console.log(
        `\npost-parse response: ${response}  type: ${typeof response}\n obj: ${JSON.stringify(
          response
        )}`
      );

      if (
        Object.hasOwn(response, "isBoilerPlateCode") &&
        Object.hasOwn(response, "code")
      ) {
        aiResponse = response;
        console.log("boiler plate: ", aiResponse.isBoilerPlateCode);
        console.log("code: ", aiResponse.code);
        break;
      }
    }

    retry--;
    if (retry > 0) {
      console.log(`\nRetrying... Attempts left: ${retry}`);
    } else {
      console.log("\nError: Ai response: ", aiResponse);
      aiResponse.code = "//Invalid code response after multiple attempts.";
    }
  }

  if (
    typeof aiResponse !== "object" ||
    aiResponse.code.trim() === "" ||
    aiResponse.isBoilerPlateCode === false
  ) {
    return;
  }

  console.log("Ai response: " + aiResponse.code);
  completionProvider.addNewCompletionItem("Code suggestion:", aiResponse.code);
  await vscode.commands.executeCommand("type", {
    text: COMMANDS.aiResponseMenuTrigger,
  });
};

export async function promptForModel(context: vscode.ExtensionContext) {
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

export async function promptForOllamaURL(context: vscode.ExtensionContext) {
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

export async function promptForOllamaHeaders(context: vscode.ExtensionContext) {
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
    });
  }

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
