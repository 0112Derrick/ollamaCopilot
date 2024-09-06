import * as vscode from "vscode";
import {
  generateCompletion,
  generateChatCompletion,
  llama3,
  defaultURLChatCompletion,
  defaultURLChat,
} from "../external/ollama";
import inlineCompletionProvider from "../providers/inlineCompletionProvider";
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
      model,
      ollamaUrl,
      JSON.parse(ollamaHeaders),
      false,
      [
        { role: "system", content: systemPrompt },
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

let lastCheckTime = 0;
export const backgroundQueryForBoilerPlateCode = async (
  model: string,
  ollamaUrl: string,
  ollamaHeaders: string,
  document: vscode.TextDocument,
  isOpenAiModel: boolean
) => {
  console.log("\nChecking doc for boiler plate code.\n");
  const currentTime = Date.now();

  console.log(
    `ct:${currentTime} lt:${lastCheckTime} result: ${
      currentTime - lastCheckTime < 5 * 1000 // check sec timeout
    }`
  );

  // Throttle the AI check to every 5 seconds
  if (currentTime - lastCheckTime < 5 * 1000) {
    return;
  }

  lastCheckTime = currentTime;

  let aiResponse: { isBoilerPlateCode: boolean | undefined; code: string } = {
    isBoilerPlateCode: undefined,
    code: "",
  };

  let retry = 3;
  const query = `Analyze the following code and respond ONLY with a JSON object. Do not include any explanation or comments.

Document content:
\`\`\`
${document.getText()}
\`\`\`

Task:
1. Determine if this is boilerplate code or user code that needs autocompletion.
2. If it's boilerplate code, complete it fully.
3. If it's user code, attempt to autocomplete the next logical part.
  a. Briefly analyze the problem you and the user are trying to solve and outline your approach to solving it.
  b. Present a clear plan of steps to solve the problem.
  c. Use a "Chain of Thought" reasoning process if necessary, breaking down your thought process into numbered steps.
4. Review your reasoning.
  a. Check for potential errors or oversights.
  b. Confirm or adjust your conclusion if necessary.
5. Provide your final answer in the "code" field.

Response format:
{
  "code": string
}

Rules:
- The "code" field should contain ONLY code, no comments or explanations.
- For boilerplate code, provide the complete code.
- For user code autocompletion, provide only the next logical part, not repeating existing code.
- Ensure the response is valid JSON.
- Do not repeat any code that was provided.
- Do not include any text outside the JSON object.`;

  const systemPrompt =
    "Match how the user codes and do not include any new feature, code that exists in the document already, and if the user has a class that already exists do not retype it in your response. Keep your code clean and concise with code comments. Do not send any code that already exists in the document. Only send JSON.";
  try {
    while (retry > 0) {
      let response = await generateChatCompletion(
        model,
        ollamaUrl,
        JSON.parse(ollamaHeaders),
        false,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ]
      );

      // console.log(
      //   `\npre-parse response: ${response}  type: ${typeof response}\n`
      // );

      if (
        (typeof response === "string" && response.trim() !== "") ||
        typeof response === "string"
      ) {
        console.log(
          "Received type of string and expected an Object.: " + response
        );
        vscode.window.showErrorMessage(
          "Received type of string and expected an Object.: " + response
        );
      }

      if (typeof response !== "string") {
        let msg =
          response.choices.at(-1)?.message.content || response.message.content;
        if (isValidJson(msg)) {
          // Validate if the response is a valid JSON
          aiResponse = JSON.parse(msg);
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
      }

      retry--;
      if (retry > 0) {
        console.log(`\nRetrying... Attempts left: ${retry}`);
      } else {
        console.log("\nError: Ai response: ", aiResponse);
        aiResponse.code = "";
      }
    }

    if (typeof aiResponse !== "object" || aiResponse.code.trim() === "") {
      return;
    }

    console.log("Ai response: " + aiResponse.code);
    const uniqueAiResponse = removeDuplicateCode(
      aiResponse.code,
      document.getText()
    );
    inlineCompletionProvider.setInlineSuggestion(uniqueAiResponse);
  } catch (e) {
    console.error(e);
  }
};

export async function promptForModel(context: vscode.ExtensionContext) {
  const currentModel = context.globalState.get<string>(
    "ollamaModel",
    llama3.name
  );

  let isOpenAiModel = context.globalState.get<boolean>("openAiModel", false);

  const model = await vscode.window.showInputBox({
    prompt: "Enter the Ollama model name",
    value: currentModel,
  });

  let val = `${isOpenAiModel}`;

  const _isOpenAiModel = await vscode.window.showInputBox({
    prompt: "Is this an openAiModel?",
    value: val,
  });
  console.log(isOpenAiModel);

  if (_isOpenAiModel) {
    if (
      _isOpenAiModel.toLowerCase() === "true" ||
      _isOpenAiModel.toLowerCase() === "t"
    ) {
      isOpenAiModel = true;
    } else {
      isOpenAiModel = false;
    }
  }

  if (model) {
    context.globalState.update("ollamaModel", model);
    context.globalState.update("openAiModel", isOpenAiModel);
    vscode.window.showInformationMessage(
      `Ollama model set to: ${model}. Is openAi model: ${isOpenAiModel}`
    );
  }
}

// export async function promptForOllamaURL(context: vscode.ExtensionContext) {
//   const currentURL = context.globalState.get<string>(
//     "ollamaURL",
//     defaultURLChatCompletion
//   );
//   const ollamaUrl = await vscode.window.showInputBox({
//     prompt: "Enter the Ollama URL",
//     value: currentURL,
//   });

//   if (ollamaUrl) {
//     context.globalState.update("ollamaURL", ollamaUrl);
//     vscode.window.showInformationMessage(`Ollama URL set to: ${ollamaUrl}`);
//   }
// }

export async function promptForOllamaURLChat(context: vscode.ExtensionContext) {
  const currentURL = context.globalState.get<string>(
    "ollamaURLChat",
    defaultURLChat
  );
  const ollamaUrl = await vscode.window.showInputBox({
    prompt: "Enter the Ollama URL",
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

function removeDuplicateCode(aiResponse: string, documentText: string): string {
  const aiLines = aiResponse.split("\n");
  const docLines = documentText.split("\n");

  // Function to normalize a line of code for comparison
  const normalizeLine = (line: string) => line.trim().replace(/\s+/g, " ");

  // Function to get all substrings of a line
  const getSubstrings = (line: string): string[] => {
    const words = line.split(/\s+/);
    return words.flatMap((_, i) =>
      words.slice(i).map((_, j) => words.slice(i, i + j + 1).join(" "))
    );
  };

  // Create a Set of all substrings from document lines for faster lookup
  const docSubstrings = new Set(
    docLines.flatMap((line) => getSubstrings(normalizeLine(line)))
  );

  // Filter and clean AI response lines
  const cleanedAiLines = aiLines.map((line) => {
    const normalizedLine = normalizeLine(line);
    const substrings = getSubstrings(normalizedLine);

    // Remove the longest matching substring from the line
    const longestMatch =
      substrings
        .filter((substr) => docSubstrings.has(substr))
        .sort((a, b) => b.length - a.length)[0] || "";

    return normalizedLine.replace(longestMatch, "").trim();
  });

  // Remove empty lines and join the result
  return cleanedAiLines.filter((line) => line !== "").join("\n");
}
