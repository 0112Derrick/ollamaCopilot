import { isValidJson } from "../utils";

declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (newState: any) => void;
};
const vscode = acquireVsCodeApi();
let ollamaImgPromise: Promise<string>;
let ollamaChatHistoryPromise: Promise<ChatContainer>;
let ollamaThemePreference: Promise<string>;

function replacer(key: string, value: any) {
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // Convert Map to array of key-value pairs
    };
  } else {
    return value;
  }
}

function reviver(key: string, value: any) {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return new Map(value.value); // Convert back to Map from array of key-value pairs
    }
  }
  return value;
}

const createPromises = () => {
  let resolveImage: (value: string) => void;
  let resolveChatHistory: (value: ChatContainer) => void;
  let resolveThemePreference: (value: string) => void;

  ollamaImgPromise = new Promise((resolve) => {
    resolveImage = resolve;
  });

  ollamaChatHistoryPromise = new Promise((resolve) => {
    resolveChatHistory = resolve;
  });

  ollamaThemePreference = new Promise((resolve) => {
    resolveThemePreference = resolve;
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "setThemePreference":
        resolveThemePreference(message.theme);
        break;
      case "setImageUri":
        resolveImage(message.imageUri);
        break;
      case "setChatHistory":
        if (isValidJson(message.data)) {
          resolveChatHistory(JSON.parse(message.data, reviver));
        } else {
          resolveChatHistory(
            new Map<
              string,
              {
                lastUpdatedTime: number;
                conversationHtml: string;
                conversationLog: { role: MessageRoles; content: string }[];
                label: string;
                queriesMade: number;
              }
            >()
          );
        }
        break;
    }
  });
};
createPromises();

const sendSignalOnLoad = () => {
  window.addEventListener("load", () => {
    vscode.postMessage({ command: "webviewReady" });
  });
};
sendSignalOnLoad();

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

/*  
Re-add code container copy button
*/
function reattachEventListeners() {
  const copyButtons: NodeListOf<HTMLElement> = document.querySelectorAll(
    ".clipboard-icon-messages"
  );

  copyButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const parentDiv = (event.target as HTMLElement).closest(
        ".user-message, .ai-message"
      );

      if (!parentDiv) {
        return;
      }

      let textToCopy = "";
      if (parentDiv.classList.contains("user-message")) {
        const userMessage = parentDiv.querySelector(".flex-nowrap");
        if (!userMessage) {
          return;
        }
        textToCopy = userMessage.children[1].textContent
          ? userMessage.children[1].textContent
          : "";
      } else if (parentDiv.classList.contains("ai-message")) {
        const aiMessage = parentDiv.querySelector(".flex-nowrap");
        if (!aiMessage) {
          return;
        }
        textToCopy = aiMessage.children[1].textContent
          ? aiMessage.children[1].textContent
          : "";
      }

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          console.info("Text was copied to the clipboard.");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
        });
    });
  });
}

type userMessageRole = "user";
type toolMessageRole = "tool";
type assistantMessageRole = "assistant";
type systemMessageRole = "system";

type MessageRoles =
  | userMessageRole
  | toolMessageRole
  | assistantMessageRole
  | systemMessageRole;

type ChatContainer = Map<
  string,
  {
    lastUpdatedTime: number;
    conversationHtml: string;
    conversationLog: { role: MessageRoles; content: string }[];
    label: string;
    queriesMade: number;
  }
>;

const deleteIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0"> <path fill-rule="evenodd" clip-rule="evenodd" d="M10.5555 4C10.099 4 9.70052 4.30906 9.58693 4.75114L9.29382 5.8919H14.715L14.4219 4.75114C14.3083 4.30906 13.9098 4 13.4533 4H10.5555ZM16.7799 5.8919L16.3589 4.25342C16.0182 2.92719 14.8226 2 13.4533 2H10.5555C9.18616 2 7.99062 2.92719 7.64985 4.25342L7.22886 5.8919H4C3.44772 5.8919 3 6.33961 3 6.8919C3 7.44418 3.44772 7.8919 4 7.8919H4.10069L5.31544 19.3172C5.47763 20.8427 6.76455 22 8.29863 22H15.7014C17.2354 22 18.5224 20.8427 18.6846 19.3172L19.8993 7.8919H20C20.5523 7.8919 21 7.44418 21 6.8919C21 6.33961 20.5523 5.8919 20 5.8919H16.7799ZM17.888 7.8919H6.11196L7.30423 19.1057C7.3583 19.6142 7.78727 20 8.29863 20H15.7014C16.2127 20 16.6417 19.6142 16.6958 19.1057L17.888 7.8919ZM10 10C10.5523 10 11 10.4477 11 11V16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16V11C9 10.4477 9.44772 10 10 10ZM14 10C14.5523 10 15 10.4477 15 11V16C15 16.5523 14.5523 17 14 17C13.4477 17 13 16.5523 13 16V11C13 10.4477 13.4477 10 14 10Z" fill="currentColor"></path></svg>`;

const ellipsesSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-md"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" fill="currentColor"></path><span class="tooltiptext">Options</span></svg>`;

const closeSvgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.63603 5.63604C6.02656 5.24552 6.65972 5.24552 7.05025 5.63604L12 10.5858L16.9497 5.63604C17.3403 5.24552 17.9734 5.24552 18.364 5.63604C18.7545 6.02657 18.7545 6.65973 18.364 7.05025L13.4142 12L18.364 16.9497C18.7545 17.3403 18.7545 17.9734 18.364 18.364C17.9734 18.7545 17.3403 18.7545 16.9497 18.364L12 13.4142L7.05025 18.364C6.65972 18.7545 6.02656 18.7545 5.63603 18.364C5.24551 17.9734 5.24551 17.3403 5.63603 16.9497L10.5858 12L5.63603 7.05025C5.24551 6.65973 5.24551 6.02657 5.63603 5.63604Z" fill="currentColor"></path></svg>`;

const copySvgIcon = `<?xml version="1.0" encoding="utf-8"?>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z" stroke="currentColor" stroke-width="1.5"/>
<path d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

const requestData = () => {
  vscode.postMessage({
    command: "requestImageUri",
  });

  vscode.postMessage({
    command: "getChat",
  });

  vscode.postMessage({
    command: "getThemePreference",
  });
};

requestData();

async function main() {
  const conversationsContainer: ChatContainer = await ollamaChatHistoryPromise;

  console.log("Map: ", conversationsContainer);

  if (!conversationsContainer) {
    console.warn("Conversation container failed to resolve.");
    return;
  }

  const ollamaImg = await ollamaImgPromise;
  console.log(`\nImg: , ${ollamaImg}\n`);

  let selectedUUID = "";
  let documentsAppendedToQuery: any[] = [];
  const themes: string[] = ["light", "dark"];
  let queriesMade: number = 0;

  const sendButton = document.querySelector("#sendButton") as HTMLButtonElement;
  const userQuery: HTMLInputElement = document.querySelector(
    "#userQuery"
  ) as HTMLInputElement;
  const loadingIndicator: HTMLInputElement = document.querySelector(
    "#loadingIndicator"
  ) as HTMLInputElement;
  const closeButton: HTMLElement = document.querySelector(
    "#sideBarCloseButton"
  ) as HTMLElement;
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
  const container = document.querySelector(".container") as HTMLElement;
  const settingsButton = document.querySelector(
    "#settingsButton"
  ) as HTMLElement;
  const settingMenuCloseButton = document.querySelector(
    "#settingMenuCloseButton"
  ) as HTMLElement;
  const themeToggle = document.querySelector("#themeToggle") as HTMLElement;

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
    if (!conversation || !conversationsContainer) {
      return;
    }
    /*
    When a recent chat is clicked. search for its uuid. Check the conversationsContainer and set the conversation html element equal to conversationData.
    Update chat history in the extension.
    Set queriesMade
    */
    if (id !== selectedUUID) {
      console.log("Clicked");
      console.log("selected uuid: ", id);
      let data = conversationsContainer.get(id);
      console.log("conversation container: ", conversationsContainer);
      if (data) {
        console.log("Data: " + JSON.stringify(data));
        console.log("Label: " + data.label);
        conversation.innerHTML = data.conversationHtml;
        queriesMade = data.queriesMade;
        //NOTE - Update the conversation log in the app.
        vscode.postMessage({
          command: "setChatHistory",
          chatHistory: data.conversationLog,
        });
      }
    }
  };

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

  const resetUserQuery = () => {
    if (!userQuery || !sendButton) {
      return;
    }

    userQuery.value = "";
    userQuery.style.height = "28px";
    sendButton.style.boxShadow = "";
  };

  const createChatLabel = (id: string, _labelName?: string) => {
    let uuid = id;
    const chatLabel = document.createElement("div");
    chatLabel.className = "label";
    chatLabel.addEventListener("click", () => {
      handleRecentChatClicked(uuid);
    });

    //FIXME - Add Rename option.
    const labelName = document.createElement("div");
    labelName.innerText = _labelName || uuid;
    labelName.className = "labelName";
    chatLabel.appendChild(labelName);

    const labelOption = document.createElement("div");
    labelOption.className = "labelOptions";
    labelOption.insertAdjacentHTML(
      "afterbegin",
      `
          <div class="labelOption tooltip">
          ${ellipsesSvg}
          </div>
          `
    );

    labelOption.addEventListener("click", (event) => {
      if (labelOption.classList.contains("active")) {
        labelOption.classList.remove("active");
      } else {
        // Prevent the event from bubbling up to other elements
        event.stopPropagation();

        // Toggle the menu visibility
        labelOption.classList.toggle("active");
      }
    });

    const menu = document.createElement("div");
    menu.className = "menu";

    const deleteButton = document.createElement("button");
    deleteButton.addEventListener("click", () => {
      conversationsContainer.delete(uuid);
      recentChatsContainer.removeChild(chatLabel);
      handleCreateConversation();
      console.log("Deleted " + uuid);
      //FIXME - add save
    });
    deleteButton.innerHTML = `<div class="flex-nowrap justifyCenter itemsCenter">${deleteIcon} Delete</div>`;
    menu.appendChild(deleteButton);
    labelOption.appendChild(menu);
    chatLabel.appendChild(labelOption);
    return chatLabel;
  };

  const updateConversationContainer = () => {
    if (!conversation || !recentChatsContainer || !conversationsContainer) {
      return;
    }

    if (selectedUUID) {
      if (!conversationsContainer.has(selectedUUID)) {
        console.log("Creating a new conversation log: " + selectedUUID);
        const chatLabel = createChatLabel(selectedUUID);
        recentChatsContainer.appendChild(chatLabel);
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

  const setTheme = (theme: string): void => {
    if (typeof theme !== "string") {
      theme = "dark";
    }

    const body = document.body;
    if (body.classList.contains(theme)) {
      return;
    } else {
      themes.forEach((_theme) => {
        body.classList.remove(_theme);
      });
      body.classList.add(theme.toLowerCase());
      themeToggle.innerText =
        theme.slice(0, 1).toUpperCase() + theme.slice(1).toLowerCase();
    }
  };

  const openSettingsMenu = () => {
    const settingsMenu = document.querySelector("#settingsMenu") as HTMLElement;
    if (!settingsMenu || !conversation) {
      return;
    }
    settingsMenu.style.height = "100%";
    conversation.style.height = "0";
  };

  const closeSettingsMenu = () => {
    const settingsMenu = document.querySelector("#settingsMenu") as HTMLElement;
    if (!settingsMenu || !conversation) {
      return;
    }
    settingsMenu.style.height = "0";
    conversation.style.height = "100%";
  };

  const openSidePanel = () => {
    const sidePanel = document.getElementById("sidePanel");
    const container = document.querySelector(".container");
    if (!sidePanel || !container) {
      return;
    }

    sidePanel.style.width = "175px"; // Set the width of the side panel
    sidePanel.style.paddingLeft = "20px";
    container.classList.add("with-panel"); // Move content to the right
    document.addEventListener("click", handleClickOutsidePanel);
  };

  const closeSidePanel = () => {
    const sidePanel = document.getElementById("sidePanel");
    const container = document.querySelector(".container");
    if (!sidePanel || !container) {
      return;
    }
    sidePanel.style.width = "0"; // Reset the width of the side panel
    sidePanel.style.paddingLeft = "0";
    container.classList.remove("with-panel"); // Move content back
    document.removeEventListener("click", handleClickOutsidePanel);
  };

  // Function to handle clicks outside the side panel
  const handleClickOutsidePanel = (event: Event) => {
    const sidePanel = document.getElementById("sidePanel");
    openSidePanelBtn;
    console.log(event.target);
    // Check if the click was outside the side panel and its content
    if (
      sidePanel &&
      !sidePanel.contains(event.target as Node) &&
      !openSidePanelBtn.contains(event.target as Node)
    ) {
      closeSidePanel();
    }
  };

  setTheme(await ollamaThemePreference);

  //Checks if key elements exist in the document.
  if (
    !userQuery ||
    !sendButton ||
    !loadingIndicator ||
    !closeButton ||
    !openSidePanelBtn ||
    !conversation ||
    !recentChatsContainer ||
    !newChatWindowButton ||
    !addFileButton ||
    !container ||
    !settingsButton ||
    !settingMenuCloseButton ||
    !themeToggle
  ) {
    console.error("One or more elements are missing from the webview.");
    console.error(` 
    ${!userQuery ? "userQuery missing" : ""} 
      ${!sendButton ? "sendButton missing" : ""} 
      ${!loadingIndicator ? "loadingIndicator missing" : ""} 
      ${!closeButton ? "closeButton missing" : ""} 
      ${!openSidePanelBtn ? "openSidePanelBtn missing" : ""} 
      ${!conversation ? "conversation container missing" : ""} 
      ${!recentChatsContainer ? "recentChatsContainer missing" : ""} 
      ${!newChatWindowButton ? "newChatWindowButton missing" : ""} 
      ${!addFileButton ? "addFileButton missing" : ""}
      ${!container ? "container missing" : ""}
      ${!settingsButton ? "settingsButton missing" : ""}
      ${!settingMenuCloseButton ? "settings close button missing" : ""}
      ${!themeToggle ? "theme toggle missing" : ""}
    `);
    return;
  }

  //Checks to see if conversationsContainer has any values already and uses the users previous chat to display, instead of the new chat screen.
  if (conversationsContainer && conversationsContainer.size) {
    conversation.style.justifyContent = "flex-start";
    let uuid = 0;
    for (let [key, val] of conversationsContainer.entries()) {
      if (val.lastUpdatedTime > uuid) {
        uuid = val.lastUpdatedTime;
        selectedUUID = key;
      }

      const chatLabel = createChatLabel(key, val.label ? val.label : key);
      recentChatsContainer.appendChild(chatLabel);
    }

    console.log("Setting to previous conversation: " + selectedUUID);
    const selectedConversation = conversationsContainer.get(selectedUUID);
    if (selectedConversation) {
      queriesMade = selectedConversation.queriesMade;
      conversation.innerHTML = selectedConversation.conversationHtml;
      //reattaches copy button event listeners.
      reattachEventListeners();
    }
  } else {
    selectedUUID = createUUID();
    console.log("No previous conversations");
  }

  console.log(
    `\nQueries made: ${queriesMade} | conversation container: ${conversation.innerHTML.trim()}`
  );

  //Sets html to intial conversation view and adds event listeners to the suggested prompts buttons
  if (queriesMade === 0 && conversation.innerHTML.trim() === "") {
    conversation.innerHTML = initialConversationView;
    addEventListenerToClass(".promptSuggestions", "click", (e: MouseEvent) => {
      promptAI((e.target as HTMLDivElement).innerHTML);
    });
  }

  newChatWindowButton.addEventListener("click", handleCreateConversation);

  addFileButton.addEventListener("click", async () => {
    vscode.postMessage({
      command: "openFileDialog",
    });
  });

  settingsButton.addEventListener("click", openSettingsMenu);

  settingMenuCloseButton.addEventListener("click", closeSettingsMenu);

  closeButton.addEventListener("click", closeSidePanel);

  openSidePanelBtn.addEventListener("click", openSidePanel);

  themeToggle.addEventListener("click", () => {
    const body = document.body;
    let newTheme = "";
    if (body.classList.contains("dark")) {
      body.classList.remove("dark");
      body.classList.add("light");
      newTheme = "light";
      themeToggle.innerText = "Light";
    } else {
      body.classList.remove("light");
      body.classList.add("dark");
      newTheme = "dark";
      themeToggle.innerText = "Dark";
    }

    vscode.postMessage({ command: "saveThemePreference", theme: newTheme });
  });

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
        userQuery.style.height = "28px";
      }
    } else {
      deactivateSendButton();
      userQuery.style.height = "28px";
      sendButton.style.boxShadow = "";
    }
  });

  userQuery.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (userQuery.value.trim() !== "" || documentsAppendedToQuery.length) {
        promptAI(userQuery.value);
      }
    }
  });

  sendButton.addEventListener("click", () => {
    if (userQuery.value.trim() !== "" || documentsAppendedToQuery.length) {
      promptAI(userQuery.value);
    }
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
      removeIcon.innerHTML = closeSvgIcon;
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
    let visibleMessage = message;
    if (documentsAppendedToQuery.length) {
      if (query.trim() === "") {
        query += `${
          documentsAppendedToQuery.length > 1
            ? `Task:
            Summarize the following documents as concisely as possible.
            Wrap each summarization into a paragraph tag <p>Summary 1</p> <p>Summary 2</p> 
            
            Documents:`
            : "Summarize the following document as concisely as possible: "
        }  `;
        visibleMessage = "Summarize the following documents: ";
      }
      query += "\n";
      visibleMessage += `<br></br> <div class="appendedDocs">Appended documents: `;
      documentsAppendedToQuery.forEach((doc, indx) => {
        query += `Document ${indx + 1} | File name: ${doc.fileName}`;
        query += doc.fileContent;
        visibleMessage +=
          indx === documentsAppendedToQuery.length - 1
            ? doc.fileName + "."
            : `${doc.fileName}, `;
        query += "\n";
      });
      visibleMessage += "</div>";
    }
    if (query.trim() === "") {
      return;
    }

    displayMessage(visibleMessage, "user");
    console.log("Container ", conversationsContainer);
    console.log(typeof conversationsContainer);
    if (conversationsContainer && !conversationsContainer.has(selectedUUID)) {
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

    resetUserQuery();
    clearDocumentsContainer();
  }

  async function displayMessage(message: string, sender: string) {
    if (!conversation) {
      return;
    }
    const ollamaImg = await ollamaImgPromise;

    const messageElement = document.createElement("div");
    messageElement.className =
      sender === "user" ? "user-message" : "ai-message clearBackground";

    // messageElement.innerText = message;
    if (messageElement.className === "ai-message clearBackground") {
      messageElement.insertAdjacentHTML(
        "afterbegin",
        `<div class="flex-nowrap pt-4">
          <img src="${ollamaImg}" alt="Ollama" class="ollama-message-icon"/>
          <div class="ai-message">${message}</div>
         </div>
        `
      );
    } else {
      messageElement.insertAdjacentHTML(
        "afterbegin",
        `<div class="flex-nowrap pt-4 itemsCenter">
         <div class="userIcon">You</div>
          <div class="userBackground">${message}</div>
         </div>`
      );
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
    clipboardIcon.innerHTML = copySvgIcon;

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
      clipboardIcon.innerHTML = copySvgIcon;
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
          aiMessage.innerText.replaceAll(copySvgIcon, "").replace("Copy", "")
        );
      };

      const toolTipCopyMessage = document.createElement("span");
      toolTipCopyMessage.className = "tooltiptext";
      toolTipCopyMessage.innerHTML = "Copy";
      clipboardIconContainer.appendChild(toolTipCopyMessage);

      const clipboardIcon_ = document.createElement("span");
      clipboardIcon_.className = "clipboard-icon-messages";
      clipboardIcon_.innerHTML = copySvgIcon;

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

  const windowListener = () => {
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
          if (!conversationsContainer || !conversationsContainer.size) {
            console.warn(
              "Conversation container is undefined or empty. ",
              conversationsContainer
            );
            return;
          }
          console.log("update chat history:", selectedUUID);
          if (conversationsContainer.has(selectedUUID)) {
            let data = conversationsContainer.get(selectedUUID);
            if (data) {
              data.lastUpdatedTime = Date.now();
              data.conversationLog = message.chatHistory;
              conversationsContainer.set(selectedUUID, data);
            }
          }

          console.log(
            "Conversation container pre save: ",
            conversationsContainer
          );
          let saveData = JSON.stringify(conversationsContainer, replacer);
          console.log("Saving chat history: " + saveData);
          vscode.postMessage({
            command: "saveChat",
            data: saveData,
          });
          break;
        case "logError":
          vscode.postMessage({
            command: "logError",
            text: `An error occurred: ${message.text}`,
          });
          break;
        case "setLabelName":
          if (!conversationsContainer) {
            return;
          }
          if (message.id) {
            if (conversationsContainer.has(message.id)) {
              let data = conversationsContainer.get(message.id);
              if (data) {
                conversationsContainer.set(message.id, {
                  ...data,
                  label: message.label,
                });
              }
              if (recentChatsContainer) {
                // Iterate over each child of recentChatsContainer
                const children = recentChatsContainer.children;
                for (let i = 0; i < children.length; i++) {
                  const child = children[i] as HTMLElement;

                  // Find the div with class 'labelName' within each child
                  const labelNameDiv = child.querySelector(
                    ".labelName"
                  ) as HTMLElement;
                  if (labelNameDiv && labelNameDiv.innerText === message.id) {
                    // Update the innerText of the labelName div
                    labelNameDiv.innerText = message.label;
                    break; // Exit the loop once the item is found and updated
                  }
                }
              }
            }
          }
          break;
        case "queryDocument":
          if (!message.query.trim()) {
            return;
          }
          promptAI(message.query.trim());
          break;
        case "eraseAllChats":
          handleCreateConversation();
          recentChatsContainer.innerHTML = "";
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
  };

  windowListener();
}
main();
