import axios from "axios";
import * as vscode from "vscode";
import { isValidJson } from "../../utils";
import { MessageRoles } from "../../providers/webViewProvider";

export const llama3 = {
  maxToken: 4096,
  name: "llama3.1",
};

export const openAIModel = {
  maxToken: 4096,
  name: "gpt-4o-mini",
};

export const openAiEmbedModel = {
  name: "text-embedding-3-large",
};

export const defaultURLChatCompletion = "http://localhost:11434/api/generate";
export const defaultURLChat = "http://localhost:11434/api/chat";
export const defaultEmbedURL = "http://localhost:11434/api/embed";

export const openAIChatCompletion =
  "https://api.openai.com/v1/chat/completions";
export const openAIEmbedUrl = "https://api.openai.com/v1/embeddings";
export const openAIGenerateImage =
  "https://api.openai.com/v1/images/generations";
export const openAITextModeration = "https://api.openai.com/v1/moderations";

export async function generateCompletion(
  query: string,
  model: string = llama3.name,
  url: string = defaultURLChatCompletion,
  headers: { [key: string]: string } = {},
  stream: boolean = false
) {
  try {
    const config = { headers };

    const data_ = {
      model,
      prompt: query,
      stream: stream,
    };

    for (let i = 0; i < 3; i++) {
      const response = await axios.post(url, data_, config);
      if (
        response.data.response === null ||
        (response.data.response && typeof response.data.response === "string")
      ) {
        return response.data.response;
      }
    }

    return "Unable to receive JSON in the correct format after multiple attempts.";
  } catch (error) {
    console.error("Error generating chat completion:", error);
    vscode.window.showErrorMessage(
      "An error occurred: Error generating chat completion: " + error
    );
    return "Error connecting to the server.";
  }
}

type choices = {
  message: { role: MessageRoles; content: string };
  finish_reason: string;
  index: number;
  logprobs: any;
}[];

//Chat with an AI model
export async function generateChatCompletion(
  model: string = llama3.name,
  url: string = defaultURLChat,
  headers: { [key: string]: string } = {},
  stream: boolean = false,
  chatHistory: { role: MessageRoles; content: string }[] = []
): Promise<
  | {
      model: string;
      created_at: string;
      choices: choices;
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
  | string
> {
  try {
    const config = {
      headers: { "Content-Type": "application/json", ...headers },
    };

    const data_ = {
      model: model,
      messages: chatHistory,
      stream: stream,
    };

    // console.log(
    //   `url: ${url} |data: ${JSON.stringify(data_)} | config: ${JSON.stringify(
    //     config
    //   )}`
    // );
    const response = await axios.post(url, data_, config);
    console.log(
      `Data sent to ollama: URL: ${url} \nData: ${JSON.stringify(
        data_
      )} \nConfig: ${JSON.stringify(config)}`
    );
    if (typeof response.data === "string" && isValidJson(response.data)) {
      return JSON.parse(response.data);
    } else {
      return response.data ? response.data : "Error generating a response.";
    }
  } catch (error) {
    console.error("Error: " + error);
    vscode.window.showErrorMessage(
      "An error occurred: Error generating chat completion: " + error
    );
    return `Error: ${error}`;
  }
}
