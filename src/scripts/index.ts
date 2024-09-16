import * as vscode from "vscode";
import {
  llama3,
  defaultURLChat,
  defaultEmbedURL,
  openAIChatCompletion,
  openAIEmbedUrl,
  openAIModel,
  openAiEmbedModel,
} from "../external/ollama";
import { LOCAL_STORAGE_KEYS as $keys } from "../constants/LocalStorageKeys";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showMessage(message: string, timeout = 5000): Promise<void> {
  try {
    // Show the information message
    const messagePromise = vscode.window.showInformationMessage(message);

    // Create a timeout to ensure the message disappears automatically
    await Promise.race([
      messagePromise,
      sleep(timeout), // Use the sleep function for a timeout
    ]);
  } catch (e) {
    console.error(e);
  }
}

export async function resetStoredValues(context: vscode.ExtensionContext) {
  const deleteStoredValues = await vscode.window.showInputBox({
    prompt:
      "Are you sure you want to reset stored values? This will clear your model, urls saved, and headers. ( yes | No )",
    value: "no",
  });

  let deleteValues = false;
  if (
    deleteStoredValues &&
    (deleteStoredValues.toLowerCase() === "yes" ||
      deleteStoredValues.toLowerCase() === "y" ||
      deleteStoredValues.toLowerCase() === "true" ||
      deleteStoredValues.toLowerCase() === "t")
  ) {
    deleteValues = true;
  }

  if (!deleteValues) {
    vscode.window.showInformationMessage("Your values were not reset.");
    return;
  }

  context.globalState.update($keys.OLLAMA_MODEL, undefined);
  context.globalState.update($keys.IS_OPENAI_MODEL, undefined);
  context.globalState.update($keys.OLLAMA_EMBED_MODEL, undefined);
  context.globalState.update($keys.OLLAMA_CHAT_COMPLETION_URL, undefined);
  context.globalState.update($keys.OLLAMA_EMBED_URL, undefined);
  context.globalState.update($keys.OLLAMA_HEADERS, undefined);
  vscode.window.showInformationMessage(
    `Your saved values have been reset. The extension may not work as expected until you set these values again.`
  );
}

export async function setupOllama(context: vscode.ExtensionContext) {
  try {
    await showMessage("Starting setup process.");

    await sleep(2000);
    await showMessage(
      "You can change these settings later. Click: ctrl+shift+p type Set Ollama"
    );

    await sleep(2000);
    await showMessage("This will take about 1 minute.");

    await sleep(2000);
    await showMessage("Using OpenAI? Have your API key ready.");

    await sleep(3000);
    const useOpenAiModel = await vscode.window.showInputBox({
      prompt: "Would you like to use OpenAI as your model (true | false)?",
      value: "false",
    });

    const useOpenAI =
      useOpenAiModel?.toLowerCase() === "true" ||
      useOpenAiModel?.toLowerCase() === "t";

    console.log("useOpenAI:", useOpenAI);

    await promptForModel(context, useOpenAI);
    await promptForOllamaURLChat(context, useOpenAI);
    await promptForOllamaHeaders(context, useOpenAI);

    await showMessage("Setup process completed successfully.");
  } catch (error) {
    console.error("Error in setup process:", error);
    await vscode.window.showErrorMessage(`Setup process failed: ${error}`);
  }
}

export async function promptForModel(
  context: vscode.ExtensionContext,
  useOpenAiModelVal?: boolean
) {
  let useOpenAI = false;
  if (useOpenAiModelVal === undefined) {
    const useOpenAiModel = await vscode.window.showInputBox({
      prompt: "Would you like to use OpenAI as your model ( true | False )?",
      value: "false",
    });

    if (
      useOpenAiModel &&
      (useOpenAiModel.toLowerCase() === "t" ||
        useOpenAiModel.toLowerCase() === "true")
    ) {
      useOpenAI = true;
    }
    console.log("val: ", useOpenAiModel);
  } else {
    useOpenAI = useOpenAiModelVal;
  }

  const currentModel = context.globalState.get<string>(
    $keys.OLLAMA_MODEL,
    useOpenAI ? openAIModel.name : llama3.name
  );

  let isOpenAiModel = context.globalState.get<boolean>(
    $keys.IS_OPENAI_MODEL,
    useOpenAI
  );

  const model = await vscode.window.showInputBox({
    prompt: "Enter the Ollama model name",
    value: currentModel,
  });

  if (model) {
    context.globalState.update($keys.OLLAMA_MODEL, model);
    context.globalState.update($keys.IS_OPENAI_MODEL, isOpenAiModel);
    vscode.window.showInformationMessage(
      `Ollama model set to: ${model}. This is a openAi model: ${
        isOpenAiModel ? "true" : "false"
      }.`
    );
    const currentEmbedModel = context.globalState.get<string>(
      $keys.OLLAMA_EMBED_MODEL,
      useOpenAI ? openAiEmbedModel.name : model
    );

    const ollamaEmbedModel = await vscode.window.showInputBox({
      prompt: "Enter the embedding model you wish to use:",
      value: currentEmbedModel,
    });

    if (ollamaEmbedModel) {
      context.globalState.update($keys.OLLAMA_EMBED_MODEL, ollamaEmbedModel);
      vscode.window.showInformationMessage(
        `Ollama embedding model set to: ${ollamaEmbedModel}`
      );
    }
  }
}
export async function promptForClearWorkspaceEmbeddedData(
  context: vscode.ExtensionContext
) {
  vscode.window.showWarningMessage(`This is permanent and cannot be reversed.`);

  const resultClearEmbeddedData = await vscode.window.showInputBox({
    prompt:
      "Would you like to clear your workspace embedded data? ( true | False )?",
    value: "false",
  });

  if (
    resultClearEmbeddedData &&
    (resultClearEmbeddedData.toLowerCase() === "t" ||
      resultClearEmbeddedData.toLowerCase() === "true")
  ) {
    context.workspaceState.update($keys.VECTOR_DATABASE_KEY, undefined);
    context.workspaceState.update($keys.WORKSPACE_DOCUMENTS_KEY, undefined);
    vscode.window.showInformationMessage(`Embedded data removed.`);
    return;
  }
  vscode.window.showInformationMessage(`Embedded data was not removed.`);
  console.log("val: ", resultClearEmbeddedData);
}

export async function promptForOllamaURLChat(
  context: vscode.ExtensionContext,
  useOpenAiModelVal?: boolean
) {
  let useOpenAI = false;
  if (useOpenAiModelVal === undefined) {
    const useOpenAiModel = await vscode.window.showInputBox({
      prompt: "Would you like to use OpenAI as your model ( true | False )?",
      value: "false",
    });

    if (
      useOpenAiModel &&
      (useOpenAiModel.toLowerCase() === "t" ||
        useOpenAiModel.toLowerCase() === "true")
    ) {
      useOpenAI = true;
    }
    console.log("val: ", useOpenAiModel);
  } else {
    useOpenAI = useOpenAiModelVal;
  }

  const currentURL = context.globalState.get<string>(
    $keys.OLLAMA_CHAT_COMPLETION_URL,
    useOpenAI ? openAIChatCompletion : defaultURLChat
  );

  const ollamaUrl = await vscode.window.showInputBox({
    prompt: "Enter the Ollama URL",
    value: currentURL,
  });

  if (ollamaUrl) {
    context.globalState.update($keys.OLLAMA_CHAT_COMPLETION_URL, ollamaUrl);
    vscode.window.showInformationMessage(`Ollama URL set to: ${ollamaUrl}`);
  }

  const currentEmbedURL = context.globalState.get<string>(
    $keys.OLLAMA_EMBED_URL,
    useOpenAI ? openAIEmbedUrl : defaultEmbedURL
  );

  const ollamaEmbedUrl = await vscode.window.showInputBox({
    prompt: "Enter the Ollama embedding URL.",
    value: currentEmbedURL,
  });

  if (ollamaEmbedUrl) {
    context.globalState.update($keys.OLLAMA_EMBED_URL, ollamaEmbedUrl);
    vscode.window.showInformationMessage(
      `Ollama Embed URL set to: ${ollamaEmbedUrl}`
    );
  }
}

export async function promptForOllamaHeaders(
  context: vscode.ExtensionContext,
  useOpenAiModelVal?: boolean
) {
  let useOpenAI = false;
  if (useOpenAiModelVal === undefined) {
    const useOpenAiModel = await vscode.window.showInputBox({
      prompt: "Would you like to use OpenAI as your model ( true | False )?",
      value: "false",
    });

    if (
      useOpenAiModel &&
      (useOpenAiModel.toLowerCase() === "t" ||
        useOpenAiModel.toLowerCase() === "true")
    ) {
      useOpenAI = true;
    }
    console.log("val: ", useOpenAiModel);
  } else {
    useOpenAI = useOpenAiModelVal;
  }

  const currentHeaders = context.globalState.get<string>(
    $keys.OLLAMA_HEADERS,
    ""
  );
  const ollamaHeaders = await vscode.window.showInputBox({
    prompt:
      "Enter the headers you need to connect with your Ollama server, separated by commas (e.g., api-key:1234, api-key2:4567).",
    value: useOpenAI ? "Authorization: Bearer *Your API Key*" : currentHeaders,
  });

  if (ollamaHeaders) {
    // Remove leading and trailing curly braces if present
    let trimmedHeaders = ollamaHeaders.trim();
    if (trimmedHeaders.startsWith("{") && trimmedHeaders.endsWith("}")) {
      trimmedHeaders = trimmedHeaders.slice(1, -1);
    }

    let headers = trimmedHeaders.split(",");
    let formattedHeaders: { [k: string]: any } = {};

    if (headers) {
      if (headers.length === 1 && headers[0] === "") {
        context.globalState.update($keys.OLLAMA_HEADERS, undefined);
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
        $keys.OLLAMA_HEADERS,
        JSON.stringify(formattedHeaders)
      );
      vscode.window.showInformationMessage(
        `Ollama headers set to: ${JSON.stringify(formattedHeaders)}`
      );
    }
  }
}

export function removeDuplicateCode(
  aiResponse: string,
  documentText: string,
  currentLine?: string
): string {
  if (!aiResponse || typeof aiResponse !== "string") {
    console.warn("Invalid aiResponse:", aiResponse);
    return aiResponse;
  }

  const aiLines = aiResponse.split("\n");
  const docLines = documentText.split("\n");

  // Function to normalize a line of code for comparison
  const normalizeLine = (line: string) => line.trim().replace(/\s+/g, " ");

  // Normalize the current line if it exists
  console.log("Current line: ", currentLine);
  const normalizedCurrentLine = currentLine ? normalizeLine(currentLine) : "";
  console.log("Normalize current line: ", normalizedCurrentLine);

  // Function to find and remove the matching part based on the current line
  const removeMatchingPart = (aiLine: string): string => {
    const normalizedAiLine = normalizeLine(aiLine);

    if (normalizedCurrentLine) {
      const matchIndex = normalizedAiLine.indexOf(normalizedCurrentLine);
      console.log("Matches found: ", matchIndex);
      if (matchIndex !== -1) {
        // Remove the matching part and any leading whitespace
        return normalizedAiLine
          .slice(matchIndex + normalizedCurrentLine.length)
          .trimStart();
      }
    }

    // If no match with currentLine, check against document lines
    for (const docLine of docLines) {
      const normalizedDocLine = normalizeLine(docLine);
      const matchIndex = normalizedAiLine.indexOf(normalizedDocLine);
      if (matchIndex !== -1) {
        // Remove the matching part and any leading whitespace
        return normalizedAiLine
          .slice(matchIndex + normalizedDocLine.length)
          .trimStart();
      }
    }

    return normalizedAiLine;
  };

  // Clean AI response lines by removing matching parts
  const cleanedAiLines = aiLines.map(removeMatchingPart);

  // Join the cleaned lines and remove any leading/trailing whitespace
  return cleanedAiLines.filter(Boolean).join("\n").trim();
}
