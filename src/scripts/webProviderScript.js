const vscode = acquireVsCodeApi();

let documentsAppendedToQuery = [];

const sendButton = document.getElementById("sendButton");
const userQuery = document.getElementById("userQuery");

sendButton.addEventListener("click", () => {
  promptAI();
});

function updateAppendedDocumentsUI() {
  const container = document.getElementById("appendedDocumentsContainer");
  container.innerHTML = ""; // Clear the existing list

  documentsAppendedToQuery.forEach((doc, index) => {
    const docElement = document.createElement("div");
    docElement.className = "appended-document";

    const docName = document.createElement("span");
    docName.innerText = doc.fileName;

    const removeIcon = document.createElement("span");
    removeIcon.className = "remove-icon";
    removeIcon.innerText = "❌";
    removeIcon.onclick = () => {
      documentsAppendedToQuery.splice(index, 1); // Remove the document from the array
      updateAppendedDocumentsUI(); // Refresh the UI
    };

    docElement.appendChild(docName);
    docElement.appendChild(removeIcon);
    container.appendChild(docElement);
  });
}

function promptAI() {
  let query = userQuery.value;
  if (documentsAppendedToQuery.length) {
    query += "\n";
    documentsAppendedToQuery.forEach((doc) => {
      query += doc.fileContent;
    });
  }
  if (query.trim() === "") {
    return;
  }

  displayMessage(query, "user");

  vscode.postMessage({
    command: "promptAI",
    query: query,
  });

  document.getElementById("loadingIndicator").style.display = "inline";

  userQuery.value = "";
}

function displayMessage(message, sender) {
  const conversation = document.getElementById("conversation");
  const messageElement = document.createElement("div");
  messageElement.className = sender === "user" ? "user-message" : "ai-message";
  messageElement.innerText = message;

  const messageOptions = document.createElement("div");
  messageOptions.className = "message-options";

  const clipboardIconContainer = document.createElement("div");
  clipboardIconContainer.className = "clipboard-icon-container tooltip";
  clipboardIconContainer.onclick = () => {
    copyToClipboard(message);
  };

  const toolTipCopyMessage = document.createElement("span");
  toolTipCopyMessage.className = "tooltiptext";
  toolTipCopyMessage.innerHTML = "Copy";
  clipboardIconContainer.appendChild(toolTipCopyMessage);

  const clipboardIcon = document.createElement("span");
  clipboardIcon.className = "clipboard-icon-messages";
  clipboardIcon.innerText = "📋";

  clipboardIconContainer.appendChild(clipboardIcon);
  messageOptions.appendChild(clipboardIconContainer);
  messageElement.appendChild(messageOptions);

  conversation.appendChild(messageElement);
  conversation.scrollTop = conversation.scrollHeight; // Scroll to the bottom
}

function parseAndDisplayResponse(aiResponse) {
  if (typeof aiResponse !== "string") {
    vscode.postMessage({
      command: "logError",
      text: `Invalid response message: \nReceived:${typeof aiResponse} | Expected a string.`,
    });

    return;
  }

  // Regular expression to match code blocks
  const codeRegex = /(.*?):\s*(\w+);\s*{([^}]+)}(.*)/s;
  const match = aiResponse.match(codeRegex);
  const conversationContainer = document.getElementById("conversation");
  const aiMessage = document.createElement("div");
  aiMessage.className = "ai-message";

  if (match) {
    const textBeforeCode = match[1]; // Text before the code block
    const language = match[2]; // Code language
    const code = match[3]; // Code content
    const remainingText = match[4]; // Text after the code block

    // Create and append the div for text before the code
    if (textBeforeCode.trim()) {
      const preCodeContainer = document.createElement("div");
      preCodeContainer.className = "pre-code-container";
      preCodeContainer.innerText = textBeforeCode.trim();
      aiMessage.appendChild(preCodeContainer);
    }

    // Create and append the div for the code block
    const codeContainer = document.createElement("div");
    codeContainer.className = "code-container";

    const clipboardIcon = document.createElement("span");
    clipboardIcon.className = "clipboard-icon";
    clipboardIcon.innerText = "📋";
    clipboardIcon.onclick = () => copyToClipboard(code);

    const codeBlock = document.createElement("pre");
    codeBlock.innerText = `Code Type: ${language}\n${code}`;

    codeContainer.appendChild(clipboardIcon);
    codeContainer.appendChild(codeBlock);
    aiMessage.appendChild(codeContainer);

    // Create and append the div for remaining text
    if (remainingText.trim()) {
      const postCodeContainer = document.createElement("div");
      postCodeContainer.className = "post-code-container";
      postCodeContainer.innerText = remainingText.trim();
      aiMessage.appendChild(postCodeContainer);
    }

    const clipboardIconContainer = document.createElement("div");
    clipboardIconContainer.className = "clipboard-icon-container tooltip";
    clipboardIconContainer.onclick = () => {
      copyToClipboard(
        aiMessage.innerText.replaceAll("📋", "").replace("Copy", "")
      );
    };

    const toolTipCopyMessage = document.createElement("span");
    toolTipCopyMessage.className = "tooltiptext";
    toolTipCopyMessage.innerHTML = "Copy";
    clipboardIconContainer.appendChild(toolTipCopyMessage);

    const clipboardIcon_ = document.createElement("span");
    clipboardIcon_.className = "clipboard-icon-messages";
    clipboardIcon_.innerText = "📋";

    clipboardIconContainer.appendChild(clipboardIcon_);

    const messageOptions = document.createElement("div");
    messageOptions.className = "message-options";
    messageOptions.appendChild(clipboardIconContainer);

    aiMessage.appendChild(messageOptions);
    conversationContainer.appendChild(aiMessage);
    conversationContainer.scrollTop = conversationContainer.scrollHeight; // Scroll to the bottom
  } else {
    // If no code block, display the entire response as regular text
    displayMessage(aiResponse, "ai");
  }

  // Hide loading indicator
  document.getElementById("loadingIndicator").style.display = "none";
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      alert("Code copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy code: ", err);
      vscode.window.showErrorMessage("Failed to copy code: " + err.message);
    });
}

window.onerror = (message, source, lineno, colno, error) => {
  vscode.postMessage({
    command: "logError",
    text: `Error: ${message} at ${source}:${lineno}:${colno}`,
  });
};

window.addEventListener("message", (event) => {
  const message = event.data;
  // console.log(JSON.stringify(message));
  switch (message.command) {
    case "displayResponse":
      parseAndDisplayResponse(message.response);
      break;
    case "fileSelected":
      const fileName = message.fileName;
      const fileContent = message.content;

      documentsAppendedToQuery.push({
        fileName: fileName,
        fileContent: fileContent,
      });
      updateAppendedDocumentsUI();
      break;
    case "logError":
      vscode.postMessage({
        command: "logError",
        text: `An error occurred: ${message.text}`,
      });

      break;
    default:
      console.log("Unknown command:", message.command);
      vscode.postMessage({
        command: "logError",
        text: `Unknown command: ${message.command}`,
      });
      break;
  }
});

document.getElementById("addFileButton").addEventListener("click", async () => {
  vscode.postMessage({
    command: "openFileDialog",
  });
});
