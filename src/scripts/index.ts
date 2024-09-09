import * as vscode from "vscode";
import { llama3, defaultURLChat } from "../external/ollama";

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
    prompt: "Is this an openAiModel? true|false",
    value: val,
  });
  console.log(isOpenAiModel);

  if (_isOpenAiModel) {
    if (
      _isOpenAiModel.toLowerCase() === "true" ||
      _isOpenAiModel.toLowerCase() === "t" ||
      _isOpenAiModel.toLowerCase() === "yes" ||
      _isOpenAiModel.toLowerCase() === "y" ||
      _isOpenAiModel.toLowerCase() === "si"
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

export function removeDuplicateCode(
  aiResponse: string,
  documentText: string
): string {
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
