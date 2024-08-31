declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (newState: any) => void;
};
const vscode = acquireVsCodeApi();

let ollamaImgPromise: Promise<string> = new Promise((resolve) => {
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.command === "setImageUri") {
      resolve(message.imageUri);
    }
  });
});

const requestImageUri = () => {
  vscode.postMessage({
    command: "requestImageUri",
  });
};

requestImageUri();

function getCurrentDate() {
  const now = new Date();

  const year = now.getFullYear(); // 4-digit year
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 2-digit month (0-based, so +1)
  const day = String(now.getDate()).padStart(2, "0"); // 2-digit day

  return `${year}-${month}-${day}`;
}

function createUUID() {
  let uuid = getCurrentDate() + Date.now();
  return uuid;
}

const addEventListenerToClass = (
  className: string,
  eventType: string,
  action: any
) => {
  document.querySelectorAll(className).forEach((elem) => {
    elem.addEventListener(eventType, action);
  });
};

type userMessageRole = "user";
type toolMessageRole = "tool";
type assistantMessageRole = "assistant";
type systemMessageRole = "system";

type MessageRoles =
  | userMessageRole
  | toolMessageRole
  | assistantMessageRole
  | systemMessageRole;

async function main() {
  const conversationsContainer = new Map<
    string,
    {
      lastUpdatedTime: number;
      conversationHtml: string;
      conversationLog: { role: MessageRoles; content: string }[];
      label: string;
      queriesMade: number;
    }
  >();

  let documentsAppendedToQuery: any[] = [];
  let queriesMade: number = 0;

  const sendButton = document.querySelector("#sendButton") as HTMLButtonElement;
  const userQuery: HTMLInputElement = document.querySelector(
    "#userQuery"
  ) as HTMLInputElement;

  const loadingIndicator: HTMLInputElement = document.querySelector(
    "#loadingIndicator"
  ) as HTMLInputElement;

  const closeButtons: NodeListOf<HTMLElement> =
    document.querySelectorAll(".closebtn");

  const openSidePanelBtn = document.querySelector(
    "#openSidePanelBtn"
  ) as HTMLInputElement;
  const conversation = document.querySelector(
    "#conversation"
  ) as HTMLInputElement;
  const recentChatsContainer = document.querySelector(
    "#chatsContainer"
  ) as HTMLInputElement;
  const documentsContainer = document.querySelector(
    "#appendedDocumentsContainer"
  ) as HTMLDivElement;
  const newChatWindowButton = document.querySelector(
    "#newChatButton"
  ) as HTMLElement;
  const addFileButton = document.querySelector("#addFileButton") as HTMLElement;

  let ollamaImg = await ollamaImgPromise;

  let selectedUUID = "";

  // console.log("\nOllama img\n", ollamaImg);
  const initialConversationView = `
        <img id="ollamaImg" src=${ollamaImg} alt="Ollama"/>
        <div class="flex suggestionsContainer">
          <div class="promptSuggestions">Code a stop watch.</div>
          <div class="promptSuggestions">List 5 projects for an intermediate developer.</div>
          <div class="promptSuggestions">Text inviting a friend to a wedding.</div>
          <div class="promptSuggestions">Python script for daily email reports.</div>
        </div>`;

  const handleRecentChatClicked = (id: string) => {
    //FIXME - Implement this.
    /* 
    When a recent chat is clicked. search for its uuid. Check the conversationsContainer and set the conversation html element equal to conversationData.
    Update chat history in the extension.
    set queries made
    */
    console.log("Clicked");
    console.log("selected uuid: ", id);
    let data = conversationsContainer.get(id);
    console.log("conversation container: ", conversationsContainer);
    if (data) {
      console.log("Data: " + JSON.stringify(data));
      console.log("Label: " + data.label);
    }
  };

  //FIXME - unknown id bug
  const handleCreateConversation = () => {
    if (!conversation) {
      return;
    }
    selectedUUID = createUUID();
    queriesMade = 0;
    conversation.style.justifyContent = "center";
    conversation.innerHTML = initialConversationView;

    addEventListenerToClass(".promptSuggestions", "click", (e: MouseEvent) => {
      promptAI((e.target as HTMLDivElement).innerHTML);
    });
    vscode.postMessage({
      command: "clearChatHistory",
    });
  };

  const handleMouseEnter = () => {
    sendButton.style.background = "#d8d8d8";
    sendButton.style.boxShadow = "3px 3px 5px #717171";
  };

  const handleMouseLeave = () => {
    sendButton.style.background = "#fff";
    sendButton.style.boxShadow = "";
  };

  const activateSendButton = () => {
    if (!sendButton) {
      return;
    }
    sendButton.disabled = false;
    sendButton.style.background = "#fff";
    sendButton.style.color = "#000";
    sendButton.style.cursor = "pointer";
    sendButton.addEventListener("mouseenter", handleMouseEnter);
    sendButton.addEventListener("mouseleave", handleMouseLeave);
  };

  const deactivateSendButton = () => {
    if (!sendButton) {
      return;
    }
    sendButton.disabled = true;
    sendButton.style.background = "#bebebe";
    sendButton.style.color = "#00000027";
    sendButton.style.cursor = "auto";
    sendButton.removeEventListener("mouseenter", handleMouseEnter);
    sendButton.removeEventListener("mouseleave", handleMouseLeave);
  };

  //FIXME - Look at me
  /* UpdateConversationContainer is being triggered when a new chat window is created and updating the selectedUUID */
  const updateConversationContainer = () => {
    if (!conversation || !recentChatsContainer) {
      return;
    }

    if (selectedUUID) {
      if (!conversationsContainer.has(selectedUUID)) {
        console.log("Creating a new conversation log: " + selectedUUID);
        const newRecentChat = document.createElement("div");
        newRecentChat.className = "recentChats";
        newRecentChat.addEventListener("click", () => {
          handleRecentChatClicked(selectedUUID);
        });
        newRecentChat.innerText = selectedUUID;

        recentChatsContainer.appendChild(newRecentChat);
        conversationsContainer.set(selectedUUID, {
          conversationHtml: conversation.innerHTML,
          lastUpdatedTime: Date.now(),
          label: selectedUUID,
          queriesMade: queriesMade,
          conversationLog: [],
        });
      } else {
        console.log("Updating conversation log: " + selectedUUID);
        let data = conversationsContainer.get(selectedUUID);
        if (data) {
          conversationsContainer.set(selectedUUID, {
            conversationHtml: conversation.innerHTML,
            lastUpdatedTime: Date.now(),
            label: data.label,
            queriesMade: queriesMade,
            conversationLog: data.conversationLog,
          });
        }
      }
    }
  };

  if (
    !userQuery ||
    !sendButton ||
    !loadingIndicator ||
    !closeButtons ||
    !openSidePanelBtn ||
    !conversation ||
    !recentChatsContainer ||
    !newChatWindowButton ||
    !addFileButton
  ) {
    console.error("One or more elements are missing from the webview.");
    console.error(` 
    ${!userQuery ? "userQuery missing" : ""} 
      ${!sendButton ? "sendButton missing" : ""} 
      ${!loadingIndicator ? "loadingIndicator missing" : ""} 
      ${!closeButtons ? "closeButtons missing" : ""} 
      ${!openSidePanelBtn ? "openSidePanelBtn missing" : ""} 
      ${!conversation ? "conversation container missing" : ""} 
      ${!recentChatsContainer ? "recentChatsContainer missing" : ""} 
      ${!newChatWindowButton ? "newChatWindowButton missing" : ""} 
      ${!addFileButton ? "addFileButton missing" : ""}
    }`);
    return;
  }

  if (conversationsContainer.size) {
    let uuid = 0;
    for (let [key, val] of conversationsContainer.entries()) {
      if (val.lastUpdatedTime > uuid) {
        uuid = val.lastUpdatedTime;
        selectedUUID = key;
      }
      recentChatsContainer.insertAdjacentHTML(
        "beforeend",
        `<div class="recentChats">${key}</div>`
      );
    }
    document.querySelectorAll(".recentChats").forEach((div, index) => {
      const correspondingKey = Array.from(conversationsContainer.keys())[index];
      console.log(correspondingKey);
      div.addEventListener("click", () =>
        handleRecentChatClicked(correspondingKey)
      );
    });
    console.log("Setting to previous conversation: " + selectedUUID);
  } else {
    selectedUUID = createUUID();
    console.log("No previous conversations");
  }

  if (selectedUUID && conversationsContainer.has(selectedUUID)) {
    conversation.innerHTML =
      conversationsContainer.get(selectedUUID)!.conversationHtml;
  }

  console.log(
    `\nQueries made: ${queriesMade} | conversation container: ${conversation.innerHTML.trim()}`
  );

  newChatWindowButton.addEventListener("click", handleCreateConversation);

  addFileButton.addEventListener("click", async () => {
    vscode.postMessage({
      command: "openFileDialog",
    });
  });

  if (queriesMade === 0 && conversation.innerHTML.trim() === "") {
    conversation.innerHTML = initialConversationView;
    addEventListenerToClass(".promptSuggestions", "click", (e: MouseEvent) => {
      promptAI((e.target as HTMLDivElement).innerHTML);
    });
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", closeSidePanel);
  });

  openSidePanelBtn.addEventListener("click", openSidePanel);

  userQuery.addEventListener("input", (e) => {
    if (!e.target) {
      return;
    }
    let elem = e.target as HTMLInputElement;
    if (elem.value.length > 0) {
      activateSendButton();
      const txt = elem.value.replace(/\r\n/g, "\n");
      const lines = txt.split("\n").length;
      console.log("\nLines: " + lines);
      if (
        (lines >= 2 && lines < 4) ||
        (elem.value.length >= 70 && elem.value.length <= 140)
      ) {
        userQuery.style.height = "100px";
      } else if (lines >= 4 || elem.value.length > 140) {
        userQuery.style.height = "200px";
      } else {
        userQuery.style.height = "auto";
      }
    } else {
      deactivateSendButton();
      userQuery.style.height = "auto";
    }
  });

  sendButton.addEventListener("click", () => {
    promptAI(userQuery.value);
  });

  function updateAppendedDocumentsUI() {
    if (!documentsContainer) {
      return;
    }
    documentsContainer.innerHTML = ""; // Clear the existing list

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
        if (
          userQuery.value.length === 0 &&
          documentsAppendedToQuery.length === 0
        ) {
          deactivateSendButton();
        }
      };

      docElement.appendChild(docName);
      docElement.appendChild(removeIcon);
      documentsContainer.appendChild(docElement);
    });
    activateSendButton();
  }

  function clearDocumentsContainer() {
    if (!documentsContainer) {
      return;
    }
    documentsContainer.innerHTML = "";
    documentsAppendedToQuery = [];
  }

  function promptAI(message: string) {
    if (!userQuery || !loadingIndicator || !sendButton || !conversation) {
      return;
    }
    deactivateSendButton();

    if (queriesMade === 0) {
      conversation.innerHTML = "";
      conversation.style.justifyContent = "flex-start";
    }

    queriesMade++;
    //userQuery.value;
    let query = message;
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

    if (!conversationsContainer.has(selectedUUID)) {
      vscode.postMessage({
        command: "getLabelName",
        query: query,
        id: selectedUUID,
      });
    }

    vscode.postMessage({
      command: "promptAI",
      query: query,
    });

    loadingIndicator.style.display = "inline";

    userQuery.value = "";
    clearDocumentsContainer();
  }

  async function displayMessage(message: string, sender: string) {
    if (!conversation) {
      return;
    }
    const ollamaImg = await ollamaImgPromise;

    const messageElement = document.createElement("div");
    messageElement.className =
      sender === "user" ? "user-message" : "ai-message";

    // messageElement.innerText = message;
    if (messageElement.className === "ai-message") {
      messageElement.insertAdjacentHTML(
        "afterbegin",
        `<div class="flex-nowrap pt-4">
          <img src="${ollamaImg}" alt="Ollama" class="ollama-message-icon"/>
          <div>${message}</div>
         </div>
        `
      );
    } else {
      messageElement.innerText = message;
    }

    const messageOptions = document.createElement("div");
    messageOptions.className = "message-options pt-4";

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
    updateConversationContainer();
  }

  async function parseAndDisplayResponse(aiResponse: string) {
    if (!loadingIndicator || !conversation) {
      return;
    }

    if (typeof aiResponse !== "string") {
      vscode.postMessage({
        command: "logError",
        text: `Invalid response message: \nReceived:${typeof aiResponse} | Expected a string.`,
      });

      return;
    }

    // Regular expression to match back ticks

    const codeRegex = /([\s\S]*?)```([\s\S]*?)```([\s\S]*)/;

    const matches = aiResponse.match(codeRegex);
    // console.log(JSON.stringify(matches));

    const aiMessage = document.createElement("div");
    aiMessage.className = "ai-message";

    if (matches && matches.length > 0) {
      const textBeforeCode = matches[1] ? matches[1].trim() : ""; // Ensure it's not undefined
      const code = matches[2] ? matches[2].trim() : ""; // Ensure it's not undefined
      const remainingText = matches[3] ? matches[3].trim() : ""; // Ensure it's not undefined

      // Create and append the div for text before the code
      if (textBeforeCode.trim()) {
        const preCodeContainer = document.createElement("div");
        preCodeContainer.className = "pre-code-container";
        const ollamaImg = await ollamaImgPromise;
        preCodeContainer.insertAdjacentHTML(
          "afterbegin",
          `<div class="flex-nowrap pt-4 itemsCenter">
            <img src="${ollamaImg}" alt="Ollama" class="ollama-message-icon"/>
            <div>${textBeforeCode.trim()}</div>
           </div>
        `
        );
        // preCodeContainer.innerText = textBeforeCode.trim();
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
      codeBlock.innerText = `\n${code}`;

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
      conversation.appendChild(aiMessage);
      conversation.scrollTop = conversation.scrollHeight; // Scroll to the bottom
      updateConversationContainer();
    } else {
      // If no code block, display the entire response as regular text
      displayMessage(aiResponse, "ai");
    }

    // Hide loading indicator
    loadingIndicator.style.display = "none";
  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("Code copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy code: ", err);
        // vscode.window.showErrorMessage("Failed to copy code: " + err.message);
        vscode.postMessage({
          command: "showErrorMessage",
          text: "Failed to copy code: " + err.message,
        });
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
      case "updateChatHistory":
        if (conversationsContainer.has(selectedUUID)) {
          let data = conversationsContainer.get(selectedUUID);
          if (data) {
            data.lastUpdatedTime = Date.now();
            data.conversationLog = message.chatHistory;
            conversationsContainer.set(selectedUUID, data);
          }
        }
        break;
      case "logError":
        vscode.postMessage({
          command: "logError",
          text: `An error occurred: ${message.text}`,
        });
        break;
      case "setLabelName":
        if (message.id) {
          if (conversationsContainer.has(message.id)) {
            conversationsContainer.set(message.id, message.label);
            if (recentChatsContainer) {
              // Find the child element with innerText matching message.id
              const children = recentChatsContainer.children;
              for (let i = 0; i < children.length; i++) {
                const child = children[i] as HTMLElement;
                if (child.innerText === message.id) {
                  // Update the innerText of the matching child element
                  child.innerText = message.label;
                  break; // Exit the loop once the item is found and updated
                }
              }
            }
          }
        }
        break;

      default:
        console.error("Unknown command:", message.command);
        vscode.postMessage({
          command: "logError",
          text: `Unknown command: ${message.command}`,
        });
        break;
    }
  });

  function openSidePanel() {
    const sidePanel = document.getElementById("sidePanel");
    const container = document.querySelector(".container");
    if (!sidePanel || !container) {
      return;
    }
    sidePanel.style.width = "150px"; // Set the width of the side panel
    sidePanel.style.paddingLeft = "20px";
    container.classList.add("with-panel"); // Move content to the right
  }

  function closeSidePanel() {
    const sidePanel = document.getElementById("sidePanel");
    const container = document.querySelector(".container");
    if (!sidePanel || !container) {
      return;
    }
    sidePanel.style.width = "0"; // Reset the width of the side panel
    sidePanel.style.paddingLeft = "0";
    container.classList.remove("with-panel"); // Move content back
  }
}
main();
