import inlineCompletionProvider from "../providers/inlineCompletionProvider";
import { isValidJson } from "../utils";
import { MessageRoles } from "../providers/webViewProvider";
import * as vscode from "vscode";
import { generateChatCompletion } from "../external/ollama";
import { removeDuplicateCode } from "../scripts";
import { VectorDatabase } from "../scripts/interfaces";

export class inlineAiSuggestionsProvider {
  // private _lastCheckTime = 0;
  private codingLanguage = "";
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay = 3000; // 3 second delay
  private retryAttempts = 3;
  private vectorDatabase: VectorDatabase;
  constructor(db: VectorDatabase) {
    this.vectorDatabase = db;
  }

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

  insertAndRemoveSpace = async () => {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const initialPosition = editor.selection.active; // Get initial cursor position

    try {
      // Insert a space
      await editor.edit((editBuilder) => {
        editBuilder.insert(initialPosition, " ");
      });

      // Get the updated position after inserting the space
      const updatedPosition = editor.selection.active;

      // Remove the space
      await editor.edit((editBuilder) => {
        editBuilder.delete(new vscode.Range(initialPosition, updatedPosition));
      });

      // Move the cursor back to the initial position
      editor.selection = new vscode.Selection(initialPosition, initialPosition);
    } catch (error) {
      console.error("Error in insertAndRemoveSpace:", error);
      vscode.window.showErrorMessage(
        `Failed to insert and remove space: ${error}`
      );
    }
  };

  triggerQueryAI(
    model: string,
    ollamaUrl: string,
    ollamaHeaders: string,
    document: vscode.TextDocument,
    focusedLine?: string
  ) {
    this.debouncedQueryAI(
      model,
      ollamaUrl,
      ollamaHeaders,
      document,
      focusedLine
    );
  }

  //FIXME - Ai response is impartial when focusing on a single line of code.
  async queryAI(
    model: string,
    ollamaUrl: string,
    ollamaHeaders: string,
    document: vscode.TextDocument,
    focusedLine?: string
  ) {
    console.log("\nChecking doc for boiler plate code.\n");

    let aiResponse: { isBoilerPlateCode: boolean | undefined; code: string } = {
      isBoilerPlateCode: undefined,
      code: "",
    };

    let retry = this.retryAttempts;
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
6. Initialize all of your variables, functions, and classes using the correct syntax.
7. Provide complete code with initializers, typings(if necessary), and assignment operators. Do not only partially fill in the users text.
${
  this.codingLanguage
    ? `8. Code in the following language: ${this.codingLanguage}`
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
- Do not include any text outside the JSON object.
- Provide complete answers.
`;

      chatHistory.push({
        role: "user",
        content: query,
      });

      const similarQueries = await this.vectorDatabase.getSimilarQueries(
        focusedLine
      );
      chatHistory.push({
        role: "user",
        content: `Here are similar queries. Use these queries in order to help you solve the users current query. ${similarQueries}`,
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

        if (
          (typeof response === "string" && response.trim() !== "") ||
          typeof response === "string"
        ) {
          console.log(
            "Received type of string and expected an Object.: " + response
          );
        }

        if (typeof response !== "string") {
          let r = response.choices;
          let msg = "";
          if (r) {
            let m = r.at(-1);
            if (m) {
              msg = m.message.content;
            }
          } else {
            msg = response.message.content;
          }

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
          if (typeof response === "string") {
            if (response.includes("Error:")) {
              retry = 0;
              aiResponse.code = "Error unable to connect to model.";
              vscode.window.showErrorMessage("Unable to connect to the model.");
              this.retryAttempts = 0;
              break;
            }
          }
          console.log(`\nRetrying... Attempts left: ${retry}`);
        } else {
          console.log("\nError Ai response: ", aiResponse);
          aiResponse.code = "";
          vscode.window.showErrorMessage(
            "Unable to connect to the model or the model is giving an unexpected response."
          );
        }
      }

      if (typeof aiResponse !== "object" || aiResponse.code.trim() === "") {
        return;
      }

      console.log("Ai response: " + aiResponse.code);
      const uniqueAiResponse = removeDuplicateCode(
        aiResponse.code,
        document.getText(),
        focusedLine ? focusedLine : ""
      );

      inlineCompletionProvider.setInlineSuggestion(uniqueAiResponse);
      await this.insertAndRemoveSpace();
    } catch (e) {
      console.error(e);
    }
  }
}
