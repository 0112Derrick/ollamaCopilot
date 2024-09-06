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
import { MessageRoles } from "../providers/webViewProvider";

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

export class inlineAiSuggestionsProvider {
  // private _lastCheckTime = 0;
  private currentLineInFocus = -1;
  private codingLanguage = "";
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay = 3000; // 3 second delay

  setCodingLanguage(language: string) {
    this.codingLanguage = language;
  }

  getCodingLanguage(): string {
    return this.codingLanguage;
  }

  private debounce(func: Function) {
    return (...args: any[]) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        func.apply(this, args);
      }, this.debounceDelay);
    };
  }

  private debouncedQueryAI = this.debounce(this.queryAI.bind(this));

  triggerQueryAI(
    model: string,
    ollamaUrl: string,
    ollamaHeaders: string,
    document: vscode.TextDocument,
    focusedLine?: string,
    currentLine?: number
  ) {
    if (!currentLine || this.currentLineInFocus !== currentLine) {
      this.debouncedQueryAI(
        model,
        ollamaUrl,
        ollamaHeaders,
        document,
        focusedLine,
        currentLine
      );
    }
  }

  async queryAI(
    model: string,
    ollamaUrl: string,
    ollamaHeaders: string,
    document: vscode.TextDocument,
    focusedLine?: string,
    currentLine?: number
  ) {
    console.log("\nChecking doc for boiler plate code.\n");
    // const currentTime = Date.now();

    // console.log(
    //   `ct:${currentTime} lt:${this._lastCheckTime} result: ${
    //     currentTime - this._lastCheckTime < 5 * 1000 // check sec timeout
    //   }`
    // );

    // // Throttle the AI check to every 5 seconds
    // if (currentTime - this._lastCheckTime < 5 * 1000) {
    //   return;
    // }

    // this._lastCheckTime = currentTime;

    if (currentLine) {
      this.currentLineInFocus = currentLine;
    }

    let aiResponse: { isBoilerPlateCode: boolean | undefined; code: string } = {
      isBoilerPlateCode: undefined,
      code: "",
    };

    let retry = 3;
    let chatHistory: { role: MessageRoles; content: string }[] = [];

    const systemPrompt =
      "Match how the user codes and do not include any new feature, code that exists in the document already, and if the user has a class that already exists do not retype it in your response. Keep your code clean and concise with code comments. Do not send any code that already exists in the document. Only send JSON.";

    chatHistory.push({
      role: "system",
      content: systemPrompt,
    });

    if (focusedLine) {
      chatHistory.push({
        role: "user",
        content:
          "This is for context. Other code in the document. : " +
          document.getText(),
      });

      const query = `Analyze the following code and respond ONLY with a JSON object. Do not include any explanation or comments.

Help me with the following code: ${focusedLine}

Task:
1. Attempt to autocomplete the next logical part.
  a. Briefly analyze the problem you and the user are trying to solve and outline your approach to solving it.
  b. Present a clear plan of steps to solve the problem.
  c. Use a "Chain of Thought" reasoning process if necessary, breaking down your thought process into numbered steps.
4. Review your reasoning.
  a. Check for potential errors or oversights.
  b. Confirm or adjust your conclusion if necessary.
5. Provide your final answer in the "code" field.
6. Provide proper code syntax based on the programming language.
${
  this.codingLanguage
    ? `7. Code in the following language: ${this.codingLanguage}`
    : ""
}

Response format:
{
  "code": string
}

Rules:
- The "code" field should contain ONLY code, no comments or explanations.
- For code autocompletion, provide only the next logical part, not repeating existing code.
- Ensure the response is valid JSON.
- Do not repeat any code that was provided.
- Do not include any text outside the JSON object.`;
      chatHistory.push({
        role: "user",
        content: query,
      });
    } else {
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
6. Provide proper code syntax based on the programming language.
${
  this.codingLanguage
    ? `7. Code in the following language: ${this.codingLanguage}`
    : ""
}

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
      chatHistory.push({
        role: "user",
        content: query,
      });
    }

    try {
      while (retry > 0) {
        let response = await generateChatCompletion(
          model,
          ollamaUrl,
          JSON.parse(ollamaHeaders),
          false,
          chatHistory
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
            response.choices.at(-1)?.message.content ||
            response.message.content;
          if (isValidJson(msg)) {
            // Validate if the response is a valid JSON
            aiResponse = JSON.parse(msg);
            console.log(
              `\npost-parse response: ${response}  type: ${typeof response}\n obj: ${JSON.stringify(
                response
              )}`
            );

            if (Object.hasOwn(aiResponse, "code")) {
              console.log("code: ", aiResponse.code);
              break;
            }
          }
        }

        retry--;
        if (retry > 0) {
          console.log(`\nRetrying... Attempts left: ${retry}`);
        } else {
          console.log("\nError Ai response: ", aiResponse);
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
  }
}

export const inlineSuggestionProvider = new inlineAiSuggestionsProvider();

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
  if (!aiResponse || typeof aiResponse !== "string") {
    console.warn("Invalid aiResponse:", aiResponse);
    return aiResponse;
  }

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
    if (!normalizedLine) {
      return "";
    }

    const substrings = getSubstrings(normalizedLine);

    // Find the longest matching substring from the line
    const longestMatch =
      substrings
        .filter((substr) => docSubstrings.has(substr))
        .sort((a, b) => b.length - a.length)[0] || "";

    // If the entire line is a duplicate, return an empty string
    if (longestMatch === normalizedLine) {
      return "";
    }

    // If there's no match or the match is the entire line, return the original line
    if (!longestMatch || longestMatch === normalizedLine) {
      return normalizedLine;
    }

    // Remove the longest matching substring from the line
    return normalizedLine.replace(longestMatch, "").trim();
  });

  // Remove empty lines and join the result
  return cleanedAiLines.filter((line) => line !== "").join("\n");
}
