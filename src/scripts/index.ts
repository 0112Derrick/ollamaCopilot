import * as vscode from "vscode";
import {
  generateCompletion,
  generateChatCompletion,
  llama3,
  defaultURLChatCompletion,
  defaultURLChat,
} from "../external/ollama";
import completionProvider from "../providers/completionProvider";
import { COMMANDS, isValidJson } from "../utils";
import exp from "constants";

interface ModelResponse {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done_reason: string;
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}

export const queryAiOnUserQueryInTextDoc = async (
  newLine: vscode.TextLine,
  newLineText: string,
  systemPrompt: string,
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  model: string,
  ollamaUrl: string,
  ollamaHeaders: string,
  documentType: string
) => {
  const currentDocText = document.getText();

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

  let response: ModelResponse | string = {
    model: "",
    created_at: "",
    message: {
      role: "",
      content: "",
    },
    done_reason: "",
    done: false,
    total_duration: 0,
    load_duration: 0,
    prompt_eval_count: 0,
    prompt_eval_duration: 0,
    eval_count: 0,
    eval_duration: 0,
  };

  let retry = 3;

  const query = newLineText.replace(COMMANDS.aiTrigger, "").trim();
  let currentDocTextPrompt = `Code your answers in the following language: ${documentType}. The following is the code inside of the users current document. This is provided for context only, do not repeat any of the content used in this document. Try and keep your code similar to the users style of code: e.g. code comments, naming of variables, functions vs variables. Code document: ${currentDocText}`;
  currentDocText;

  let reply = "";

  while (retry > 0) {
    response = await generateChatCompletion(
      systemPrompt,
      model,
      ollamaUrl,
      JSON.parse(ollamaHeaders),
      false,
      [
        { role: "system", content: currentDocTextPrompt },
        { role: "user", content: query },
      ]
    );

    if (typeof response === "string" && response.trim() !== "") {
      reply = response;
      break;
    } else if (typeof response === "object") {
      if (isValidJson(response.message.content)) {
        console.log(JSON.stringify(response));
        reply = response.message.content.replaceAll("```", "");
        if (reply.trim() !== "") {
          break;
        }
      } else {
        reply = response.message.content.replaceAll("```", "");
        if (reply.trim() !== "") {
          break;
        }
      }
    }
    retry--;
    if (retry > 0) {
      console.log(`\nRetrying... Attempts left: ${retry}\n`);
    } else {
      console.log("\nError: Ai response: ", response);
      response = "//Invalid code response after multiple attempts.";
    }
  }

  // if (typeof response !== "string" || response.trim() === "") {
  //   response = "Unable to connect to ollama.";
  // }

  const updatedLine = editor.document.lineAt(newLine.range.start.line);
  const updatedLineRange = updatedLine.range;

  editor.edit((editBuilder) => {
    editBuilder.replace(updatedLineRange, "");

    const nextPosition = new vscode.Position(newLine.range.start.line, 0);
    editor.selection = new vscode.Selection(nextPosition, nextPosition);
  });

  completionProvider.addNewCompletionItem("Suggestion", reply);
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

  let aiResponse: { isBoilerPlateCode: boolean | undefined; code: string } = {
    isBoilerPlateCode: undefined,
    code: "",
  };

  let retry = 3;
  const query = `Does the code in the document look like boiler plate code? document: ${document.getText()}. If it is boiler plate code then send json in the following format: {"isBoilerPlateCode": true,"code":"Insert the finished boiler plate code here."}. In all other cases send back json like this: {"isBoilerPlateCode": false, "code": ""}. Do not send any code that already exists in the document (If you wish to make a change to an existing class or function send a code comment e.g: {"isBoilerPlateCode": true, "code": "//change class X to add in Y property" }. Only send JSON.)`;
  const systemPrompt =
    "Match how the user codes and do not include any new feature, code that exists in the document already, and if the user has a class that already exists do not retype it in your response. Keep your code clean and concise with code comments. Do not send any code that already exists in the document. Only send JSON.";
  try {
    while (retry > 0) {
      let response = await generateChatCompletion(
        systemPrompt,
        model,
        ollamaUrl,
        JSON.parse(ollamaHeaders),
        false,
        [{ role: "user", content: query }]
      );

      //console.log(`\npre-parse response: ${r}  type: ${typeof r}\n`);

      // let response = await generateCompletion(
      //   query,
      //   model,
      //   ollamaUrl,
      //   JSON.parse(ollamaHeaders)
      // );
      console.log(
        `\npre-parse response: ${response}  type: ${typeof response}\n`
      );

      if (typeof response === "string" && response.trim() !== "") {
        console.log(
          "Received type of string and expected an Object.: " + response
        );
        // vscode.window.showErrorMessage(
        //   "Received type of string and expected an Object.: " + response
        // );
      } else if (
        typeof response !== "string" &&
        isValidJson(response.message.content)
      ) {
        // Validate if the response is a valid JSON
        aiResponse = JSON.parse(response.message.content);

        console.log(
          `\npost-parse response: ${response}  type: ${typeof response}\n obj: ${JSON.stringify(
            response
          )}`
        );

        if (
          Object.hasOwn(aiResponse, "isBoilerPlateCode") &&
          aiResponse.isBoilerPlateCode !== undefined &&
          Object.hasOwn(aiResponse, "code")
        ) {
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
    completionProvider.addNewCompletionItem(
      "Code suggestion:",
      aiResponse.code
    );
    await vscode.commands.executeCommand("type", {
      text: COMMANDS.aiResponseMenuTrigger,
    });
  } catch (e) {
    console.error(e);
  }
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
  const currentURL = context.globalState.get<string>(
    "ollamaURL",
    defaultURLChatCompletion
  );
  const ollamaUrl = await vscode.window.showInputBox({
    prompt: "Enter the Ollama URL",
    value: currentURL,
  });

  if (ollamaUrl) {
    context.globalState.update("ollamaURL", ollamaUrl);
    vscode.window.showInformationMessage(`Ollama URL set to: ${ollamaUrl}`);
  }
}

export async function promptForOllamaURLChat(context: vscode.ExtensionContext) {
  const currentURL = context.globalState.get<string>(
    "ollamaURLChat",
    defaultURLChat
  );
  const ollamaUrl = await vscode.window.showInputBox({
    prompt: "Enter the Ollama URL for the webview",
    value: currentURL,
  });

  if (ollamaUrl) {
    context.globalState.update("ollamaURLChat", ollamaUrl);
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
