import { isValidJson } from "../utils";
import {
  deleteIcon,
  closeSvgIcon,
  ellipsesSvg,
  copySvgIcon,
  editSvgIcon,
} from "../svgs";
import { MessageRoles } from "../providers/webViewProvider";
import { HTML_IDS as $id } from "../constants/HTMLElementIds";
import {
  reviver,
  MissingElementError,
  createUUID,
  addEventListenerToClass,
  replacer,
  isOverflown,
} from "./utils";
import { ChatContainer, OllamaWebviewThemes } from "./interfaces";

declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (newState: any) => void;
};

const vscode = acquireVsCodeApi();

let ollamaImgPromise: Promise<string>;
let ollamaChatHistoryPromise: Promise<ChatContainer>;
let ollamaThemePreference: Promise<OllamaWebviewThemes>;
let ollamaUserSystemPrompt: Promise<string>;

const createPromises = () => {
  let resolveImage: (value: string) => void;
  let resolveChatHistory: (value: ChatContainer) => void;
  let resolveThemePreference: (value: OllamaWebviewThemes) => void;
  let resolveSystemPrompt: (value: string) => void;

  ollamaImgPromise = new Promise((resolve) => {
    resolveImage = resolve;
  });

  ollamaChatHistoryPromise = new Promise((resolve) => {
    resolveChatHistory = resolve;
  });

  ollamaThemePreference = new Promise((resolve) => {
    resolveThemePreference = resolve;
  });

  ollamaUserSystemPrompt = new Promise((resolve) => {
    resolveSystemPrompt = resolve;
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
        try {
        } catch (e) {}
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
      case "setUserSystemPrompt":
        resolveSystemPrompt(message.systemPrompt);
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

/*  
Re-add code container copy button
*/
function reattachEventListeners() {
  const _copyButtons: NodeListOf<HTMLElement> = document.querySelectorAll(
    ".clipboard-icon-messages"
  );

  const _codeContainerCopyButtons: NodeListOf<HTMLElement> =
    document.querySelectorAll(".clipboard-icon");

  const copyButtons: HTMLElement[] = [
    ...Array.from(_copyButtons),
    ...Array.from(_codeContainerCopyButtons),
  ];

  copyButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const parentDiv = (event.target as HTMLElement).closest(
        ".user-message, .ai-message, .code-container"
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
        const codeContainer = parentDiv.querySelector(".code-container");

        // Default case: No code-container, copy from .flex-nowrap
        if (!codeContainer) {
          const aiMessage = parentDiv.querySelector(".flex-nowrap");
          if (aiMessage && aiMessage.children[1]) {
            textToCopy = aiMessage.children[1].textContent || "";
          }
        }

        // Special case: AI message with code-container
        else {
          /* 
          3 options:
           Pre-code-container + code-container + post-code-container
           Pre-code-container + code-container
           code-container + post-code-container

           -- in order to get the text from pre-code-container I need to access its inner child and select the inner child's the 2nd element.

           -- in order to get the text from the code container I need to access code-container and then get the text from the pre element.

           -- in order to get the text from post code container i need to get its inner html
          */
          const preCodeContainer = parentDiv.querySelector(
            ".pre-code-container"
          );
          const codeElement = parentDiv.querySelector(".code-container pre");
          const postCodeContainer = parentDiv.querySelector(
            ".post-code-container"
          );

          if (preCodeContainer && preCodeContainer.children[0].children[1]) {
            textToCopy +=
              preCodeContainer.children[0].children[1].textContent + "\n" || "";
          }

          if (codeElement) {
            textToCopy += codeElement.textContent + "\n" || "";
          }

          if (postCodeContainer) {
            textToCopy += postCodeContainer.textContent + "/n" || "";
          }
        }
      } else if (parentDiv.classList.contains("code-container")) {
        const code = parentDiv.children[1].textContent;
        // console.log("code: ", code);
        textToCopy = code ? code : "";
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

//Requests data from the extension on load.
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

  vscode.postMessage({
    command: "getUserSystemPrompt",
  });
};

requestData();

async function main() {
  const conversationsContainer: ChatContainer = await ollamaChatHistoryPromise;

  const DOM: { [key: string]: HTMLElement } = {};

  // console.log("Conversation container size: " + conversationsContainer.size);

  if (!conversationsContainer) {
    console.warn("Conversation container failed to resolve.");
    return;
  }

  const ollamaImg = await ollamaImgPromise;

  const userSystemPrompt = await ollamaUserSystemPrompt;

  let selectedUUID = "";
  let documentsAppendedToQuery: {
    fileName: string;
    fileContent: string;
    filePath: string;
  }[] = [];
  let documentsToEmbed: {
    fileName: string;
    fileContent: string;
    filePath: string;
  }[] = [];
  let queriesMade: number = 0;
  //create html element objects using the values from the html_ids file and

  for (let elem_id in $id) {
    let elem = document.getElementById($id[elem_id as keyof typeof $id]);
    if (elem) {
      let e: string = $id[elem_id as keyof typeof $id];
      DOM[e] = elem;
    } else {
      throw new MissingElementError(
        `Element id ${$id}: ${$id[elem_id as keyof typeof $id]} not found!`
      );
    }
  }

  const initialConversationView = `
        <img id="ollamaImg" src=${ollamaImg} alt="Ollama"/>
        <div class="suggestionsContainer">
          <div class="promptSuggestions">Code a stop watch.</div>
          <div class="promptSuggestions">List 5 projects for an intermediate developer.</div>
          <div class="promptSuggestions">Python script for daily email reports.</div>
          <div class="promptSuggestions" data-options>Options.</div>
        </div>`;

  const optionsString = `"This is additional information related to this query: Ollama copilot can help auto complete code using inline suggestions. You can highlight code and right click to use pre-created prompts for refactoring, understanding, and improving code. To switch your model use ctrl + shft + p or cmd + shft + p on mac and type ollama to view settings about switching your model, hosted machine, or setting up headers. Ollama copilot can be connected to OpenAi by setting their headers in accordance to what OpenAI expects and setting their url/model to what openAI expects. Tell the user about these capabilities. You are Ollama Copilot so talk in first person about your capabilities and do it concisely."`;
  const options_connectingToOpenAI = `
   Set your headers my clicking ctrl+shift+p or cmd+shift+p for mac type ollama Set Ollama Headers set it to: {"Authorization":"Bearer *Your token here*"}
   Set your url following the same steps as before and go to Set ollama url, set the value to: https://api.openai.com/v1/chat/completions or whatever the current documentation says for connecting to OpenAi chat completions.
   Lastly set your model following the same steps as before and set it to a chatgpt model.
   `;

  const handleRecentChatClicked = (id: string) => {
    if (!conversationsContainer) {
      return;
    }
    /*
    When a recent chat is clicked. search for its uuid. Check the conversationsContainer and set the conversation html element equal to conversationData.
    Update chat history in the extension.
    Set queriesMade
    */
    if (id !== selectedUUID) {
      // console.log("selected uuid: ", id);
      let data = conversationsContainer.get(id);
      // console.log("conversation container: ", conversationsContainer);
      if (data) {
        // console.log("Data: " + JSON.stringify(data));
        // console.log("Label: " + data.label);
        DOM[$id.CONVERSATION].innerHTML = data.conversationHtml;

        queriesMade = data.queriesMade;
        selectedUUID = id;
        //NOTE - Update the conversation log in the app.
        vscode.postMessage({
          command: "setChatHistory",
          chatHistory: data.conversationLog,
        });
      }
    }
  };

  const handleCreateConversation = () => {
    selectedUUID = createUUID();
    queriesMade = 0;
    DOM[$id.CONVERSATION].style.justifyContent = "center";
    DOM[$id.CONVERSATION].innerHTML = initialConversationView;

    addEventListenerToClass(".promptSuggestions", "click", (e: MouseEvent) => {
      const elem = e.target as HTMLDivElement;

      if (elem.hasAttribute("data-options")) {
        promptAI((e.target as HTMLDivElement).innerHTML, optionsString);
      } else {
        promptAI((e.target as HTMLDivElement).innerHTML);
      }
      // promptAI((e.target as HTMLDivElement).innerHTML);
    });

    vscode.postMessage({
      command: "clearChatHistory",
    });
  };

  const handleMouseEnter = () => {
    DOM[$id.SEND_BUTTON].style.background = "#d8d8d8";
    DOM[$id.SEND_BUTTON].style.boxShadow = "3px 3px 5px #717171";
  };

  const handleMouseLeave = () => {
    DOM[$id.SEND_BUTTON].style.background = "#fff";
    DOM[$id.SEND_BUTTON].style.boxShadow = "";
  };

  const activateSendButton = () => {
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).disabled = false;
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.background = "#fff";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.color = "#000";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.cursor = "pointer";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).addEventListener(
      "mouseenter",
      handleMouseEnter
    );
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).addEventListener(
      "mouseleave",
      handleMouseLeave
    );
  };

  const deactivateSendButton = () => {
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).disabled = true;
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.background = "#bebebe";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.color = "#00000027";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.cursor = "auto";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).removeEventListener(
      "mouseenter",
      handleMouseEnter
    );
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).removeEventListener(
      "mouseleave",
      handleMouseLeave
    );
  };

  const resetUserQuery = () => {
    (DOM[$id.SEARCH_BAR] as HTMLInputElement).value = "";

    DOM[$id.SEARCH_BAR].style.height = "";
    (DOM[$id.SEND_BUTTON] as HTMLButtonElement).style.boxShadow = "";
    DOM[$id.SEARCH_BAR].style.overflowY = "";
  };

  const createChatLabel = (id: string, _labelName?: string) => {
    let uuid = id;
    const chatLabel = document.createElement("div");
    chatLabel.className = "label";
    chatLabel.addEventListener("click", () => {
      handleRecentChatClicked(uuid);
    });

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
      DOM[$id.RECENT_CHATS_CONTAINER].removeChild(chatLabel);
      // recentChatsContainer.removeChild(chatLabel);
      handleCreateConversation();
      // console.log("Deleted " + uuid);
      saveData();
    });
    deleteButton.innerHTML = `<div class="flex-nowrap justifyCenter itemsCenter">${deleteIcon} Delete</div>`;

    const editButton = document.createElement("button");
    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      labelOption.classList.remove("active");
      // chatLabel.innerHTML = "";
      const inputField = document.createElement("input");
      inputField.type = "text";
      inputField.value = labelName.innerText;

      const handleSubmit = () => {
        labelName.innerText = inputField.value;
        try {
          if (labelName.contains(inputField)) {
            labelName.removeChild(inputField);
          }
        } catch (e) {
          console.log(e);
        }

        let component = conversationsContainer.get(uuid);
        if (component) {
          // console.log("Updating conversation container.");
          component.label = inputField.value;
        }
        saveData();
      };

      inputField.addEventListener("blur", handleSubmit);
      inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      });

      labelName.appendChild(inputField);
      inputField.focus();
    });

    editButton.innerHTML = `<div class="flex-nowrap justifyCenter itemsCenter">${editSvgIcon} Edit</div>`;

    menu.appendChild(deleteButton);
    menu.appendChild(editButton);
    labelOption.appendChild(menu);
    chatLabel.appendChild(labelOption);
    return chatLabel;
  };

  const updateConversationContainer = () => {
    if (!conversationsContainer) {
      return;
    }

    if (selectedUUID) {
      if (!conversationsContainer.has(selectedUUID)) {
        // console.log("Creating a new conversation log: " + selectedUUID);
        const chatLabel = createChatLabel(selectedUUID);
        DOM[$id.RECENT_CHATS_CONTAINER].appendChild(chatLabel);
        // recentChatsContainer.appendChild(chatLabel);

        conversationsContainer.set(selectedUUID, {
          conversationHtml: DOM[$id.CONVERSATION].innerHTML,
          lastUpdatedTime: Date.now(),
          label: selectedUUID,
          queriesMade: queriesMade,
          conversationLog: [],
        });
      } else {
        // console.log("Updating conversation log: " + selectedUUID);
        let data = conversationsContainer.get(selectedUUID);
        if (data) {
          conversationsContainer.set(selectedUUID, {
            conversationHtml: DOM[$id.CONVERSATION].innerHTML,
            lastUpdatedTime: Date.now(),
            label: data.label,
            queriesMade: queriesMade,
            conversationLog: data.conversationLog,
          });
        }
      }
    }
  };

  const setTheme = (theme: OllamaWebviewThemes): void => {
    if (typeof theme !== "string") {
      theme = "dark";
    }

    const themes: OllamaWebviewThemes[] = [
      "light",
      "dark",
      "rose-gold",
      "high-contrast",
      "pokemon-theme",
    ];

    const body = document.body;
    if (body.classList.contains(theme)) {
      return;
    } else {
      themes.forEach((_theme) => {
        body.classList.remove(_theme);
      });
      body.classList.add(theme.toLowerCase());
    }

    // Update the radio button selection
    switch (theme) {
      case "light":
        (DOM[$id.THEME_TOGGLE_LIGHT] as HTMLInputElement).checked = true;
        break;
      case "dark":
        (DOM[$id.THEME_TOGGLE_DARK] as HTMLInputElement).checked = true;
        break;
      case "rose-gold":
        (DOM[$id.THEME_TOGGLE_ROSE_GOLD] as HTMLInputElement).checked = true;
        break;
      case "high-contrast":
        (DOM[$id.THEME_TOGGLE_HIGH_CONTRAST] as HTMLInputElement).checked =
          true;
        break;
      case "pokemon-theme":
        (DOM[$id.THEME_TOGGLE_POKEMON_THEME] as HTMLInputElement).checked =
          true;
        break;
      default:
        (DOM[$id.THEME_TOGGLE_DARK] as HTMLInputElement).checked = true;
    }
  };

  const switchToggle = () => {
    const selectedTheme = (
      document.querySelector(
        'input[name="themeToggle"]:checked'
      ) as HTMLInputElement
    ).value.toLowerCase() as OllamaWebviewThemes;

    setTheme(selectedTheme);

    // Send the selected theme to the VS Code extension

    vscode.postMessage({
      command: "saveThemePreference",
      theme: selectedTheme,
    });
  };

  const openSettingsMenu = () => {
    const settingsMenu = document.querySelector("#settingsMenu") as HTMLElement;
    if (!settingsMenu) {
      return;
    }
    settingsMenu.style.height = "100%";
    // DOM[$id.CONVERSATION].style.height = "0";
    DOM[$id.CONVERSATION].style.visibility = "hidden";
    DOM[$id.PROMPT_BAR].style.visibility = "hidden";
    // conversation.style.height = "0";
    closeSidePanel();
  };

  const closeSettingsMenu = () => {
    const settingsMenu = document.querySelector("#settingsMenu") as HTMLElement;
    if (!settingsMenu) {
      return;
    }
    settingsMenu.style.height = "0";
    // DOM[$id.CONVERSATION].style.height = "100%";
    DOM[$id.CONVERSATION].style.visibility = "visible";

    DOM[$id.PROMPT_BAR].style.visibility = "visible";
    // conversation.style.height = "100%";
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

    // Check if the click was outside the side panel and its content
    if (
      sidePanel &&
      !sidePanel.contains(event.target as Node) &&
      !DOM[$id.OPEN_SIDE_PANEL_BUTTON].contains(event.target as Node)
    ) {
      let activeSidePanelMenus = document.querySelectorAll(".active");
      if (activeSidePanelMenus) {
        activeSidePanelMenus.forEach((menu) => {
          menu.classList.remove("active");
        });
      }

      // console.log("Closing side panel", event.target);
      closeSidePanel();
    }
  };

  const saveData = (): void => {
    const saveData = JSON.stringify(conversationsContainer, replacer);
    // console.log("Saving chat history.");
    vscode.postMessage({
      command: "saveChat",
      data: saveData,
    });
    return;
  };

  function debounce(func: (...args: any[]) => void, delay: number) {
    let debounceTimer: NodeJS.Timeout | undefined;

    return (...args: any[]) => {
      // Clear the previous timer if it exists
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Set a new timer to invoke the function after the specified delay
      debounceTimer = setTimeout(() => {
        func(...args); // Call the original function with the provided arguments
      }, delay);
    };
  }

  const debounceSystemPrompt = debounce((systemPrompt: string) => {
    vscode.postMessage({
      command: "saveUserSystemPrompt",
      systemPrompt: systemPrompt || "",
    });
  }, 3000);

  DOM[$id.SYSTEM_PROMPT].addEventListener("input", (e) => {
    const systemPrompt = (e.target as HTMLInputElement).value;
    if (systemPrompt.trim() === "") {
      console.log("Input cleared");
      debounceSystemPrompt(systemPrompt); // Call your debounce function
    } else {
      debounceSystemPrompt(systemPrompt);
    }
  });

  setTheme(await ollamaThemePreference);

  DOM[$id.SYSTEM_PROMPT].innerText = userSystemPrompt;

  //Checks to see if conversationsContainer has any values already and uses the users previous chat to display, instead of the new chat screen.
  if (conversationsContainer && conversationsContainer.size) {
    DOM[$id.CONVERSATION].style.justifyContent = "flex-start";
    //conversation.style.justifyContent = "flex-start";
    let uuid = 0;
    for (let [key, val] of conversationsContainer.entries()) {
      if (val.lastUpdatedTime > uuid) {
        uuid = val.lastUpdatedTime;
        selectedUUID = key;
      }
      // console.log("Label set to: " + val.label);
      const chatLabel = createChatLabel(key, val.label ? val.label : key);
      DOM[$id.RECENT_CHATS_CONTAINER].appendChild(chatLabel);
    }

    // console.log("Setting to previous conversation: " + selectedUUID);
    const selectedConversation = conversationsContainer.get(selectedUUID);
    if (selectedConversation) {
      queriesMade = selectedConversation.queriesMade;
      DOM[$id.CONVERSATION].innerHTML = selectedConversation.conversationHtml;
      reattachEventListeners();
    }
  } else {
    selectedUUID = createUUID();
    // console.log("No previous conversations");
  }

  /* console.log(
    `\nQueries made: ${queriesMade} | conversation container: ${DOM[
      $id.CONVERSATION
    ].innerHTML.trim()}`
  ); */

  //Sets html to intial conversation view and adds event listeners to the suggested prompts buttons
  if (queriesMade === 0 && DOM[$id.CONVERSATION].innerHTML.trim() === "") {
    DOM[$id.CONVERSATION].innerHTML = initialConversationView;
    addEventListenerToClass(".promptSuggestions", "click", (e: MouseEvent) => {
      const elem = e.target as HTMLDivElement;
      if (elem.hasAttribute("data-options")) {
        promptAI((e.target as HTMLDivElement).innerHTML, optionsString);
      } else {
        promptAI((e.target as HTMLDivElement).innerHTML);
      }
    });
  }

  // newChatWindowButton.addEventListener("click", handleCreateConversation);
  DOM[$id.NEW_CHAT_WINDOW_BUTTON].addEventListener(
    "click",
    handleCreateConversation
  );

  DOM[$id.ADD_FILE_BUTTON].addEventListener("click", async () => {
    vscode.postMessage({
      command: "openFileDialog",
      embeddedDoc: false,
    });
  });

  DOM[$id.EMBED_FILE_BUTTON].addEventListener("click", async () => {
    vscode.postMessage({
      command: "openFileDialog",
      embeddedDoc: true,
    });
  });

  DOM[$id.SAVE_EMBEDDED_DOCS_BUTTON].addEventListener("click", async () => {
    if (!documentsToEmbed.length) {
      return;
    }
    vscode.postMessage({
      command: "embedFiles",
      files: documentsToEmbed,
    });
  });

  DOM[$id.SETTINGS_BUTTON].addEventListener("click", openSettingsMenu);

  DOM[$id.SETTINGS_MENU_CLOSE_BUTTON].addEventListener(
    "click",
    closeSettingsMenu
  );

  DOM[$id.SIDEBAR_CLOSE_BUTTON].addEventListener("click", closeSidePanel);

  DOM[$id.OPEN_SIDE_PANEL_BUTTON].addEventListener("click", openSidePanel);

  DOM[$id.THEME_TOGGLE_DARK].addEventListener("click", switchToggle);
  DOM[$id.THEME_TOGGLE_LIGHT].addEventListener("click", switchToggle);
  DOM[$id.THEME_TOGGLE_ROSE_GOLD].addEventListener("click", switchToggle);
  DOM[$id.THEME_TOGGLE_HIGH_CONTRAST].addEventListener("click", switchToggle);
  DOM[$id.THEME_TOGGLE_POKEMON_THEME].addEventListener("click", switchToggle);
  // Helper function to calculate the rendered width of the text
  function getTextWidth(text: string, font: string) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.font = font; // Use the same font as the textarea
    const metrics = context.measureText(text);
    return metrics.width;
  }

  DOM[$id.SEARCH_BAR].addEventListener("input", (e) => {
    if (!e.target) {
      return;
    }
    let searchBar = e.target as HTMLInputElement;
    if (searchBar.value.length > 0 && searchBar.value.trim() !== "") {
      activateSendButton();

      const textLength = getTextWidth(
        searchBar.value,
        getComputedStyle(searchBar).font
      );

      const searchBarWidth = searchBar.clientWidth;

      if (
        isOverflown(searchBar) &&
        textLength &&
        textLength > 0.8 * searchBarWidth
      ) {
        const currentHeight = parseInt(getComputedStyle(searchBar).height, 10);
        // Increase height by 28px while respecting max-height in CSS
        searchBar.style.height =
          Math.min(currentHeight + 28, window.innerHeight * 0.25) + "px";
      }

      if (
        parseInt(getComputedStyle(searchBar).height, 10) >
        window.innerHeight * 0.24
      ) {
        searchBar.style.overflowY = "scroll";
      } else {
        searchBar.style.overflowY = "";
      }
    } else {
      deactivateSendButton();
      DOM[$id.SEARCH_BAR].style.height = "";
      DOM[$id.SEARCH_BAR].style.boxShadow = "";
    }
  });

  DOM[$id.SEARCH_BAR].addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (
        (DOM[$id.SEARCH_BAR] as HTMLFormElement).value.trim() !== "" ||
        documentsAppendedToQuery.length
      ) {
        const originalQuery = (DOM[$id.SEARCH_BAR] as HTMLInputElement).value;
        let query = originalQuery;
        query = query.toLowerCase().trim().replace(".", "");
        //FIXME - Add details for setting up model AI assistant if no response detected.
        if (
          query === "option" ||
          query === "options" ||
          query === "setting" ||
          query === "settings" ||
          query === "help" ||
          query === "info"
        ) {
          promptAI(query, optionsString);
        } else if (
          query === "connect to chatgpt" ||
          query === "use chatgpt" ||
          query === "chatgpt" ||
          query === "openai"
        ) {
          promptAI(query, options_connectingToOpenAI);
        } else {
          promptAI(originalQuery);
        }
      }
    }
  });

  DOM[$id.SEND_BUTTON].addEventListener("click", () => {
    if (
      (DOM[$id.SEARCH_BAR] as HTMLInputElement).value.trim() !== "" ||
      documentsAppendedToQuery.length
    ) {
      promptAI((DOM[$id.SEARCH_BAR] as HTMLInputElement).value);
    }
  });

  function updateAppendedDocumentsUI() {
    DOM[$id.APPENDED_DOCUMENTS_CONTAINER].innerHTML = ""; // Clear the existing list

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
          (DOM[$id.SEARCH_BAR] as HTMLInputElement).value.length === 0 &&
          documentsAppendedToQuery.length === 0
        ) {
          deactivateSendButton();
        }
      };

      docElement.appendChild(docName);
      docElement.appendChild(removeIcon);

      DOM[$id.APPENDED_DOCUMENTS_CONTAINER].appendChild(docElement);
    });
    activateSendButton();
  }

  function updateEmbeddedDocumentsUI() {
    DOM[$id.DIV_DOCS_TO_EMBED_CONTAINER].innerHTML = ""; // Clear the existing list

    documentsToEmbed.forEach((doc, index) => {
      const docElement = document.createElement("div");
      docElement.className = "appended-document";

      const docName = document.createElement("span");
      docName.innerText = doc.fileName;

      const removeIcon = document.createElement("span");
      removeIcon.className = "remove-icon";
      removeIcon.innerHTML = closeSvgIcon;
      removeIcon.onclick = () => {
        documentsToEmbed.splice(index, 1); // Remove the document from the array
        updateEmbeddedDocumentsUI(); // Refresh the UI
      };

      docElement.appendChild(docName);
      docElement.appendChild(removeIcon);

      DOM[$id.DIV_DOCS_TO_EMBED_CONTAINER].appendChild(docElement);
    });
  }

  function clearDocumentsContainer() {
    DOM[$id.APPENDED_DOCUMENTS_CONTAINER].innerHTML = "";

    documentsAppendedToQuery = [];
  }

  function promptAI(message: string, contextMessage?: string) {
    deactivateSendButton();
    closeSettingsMenu();

    if (queriesMade === 0) {
      DOM[$id.CONVERSATION].innerHTML = "";
      DOM[$id.CONVERSATION].style.justifyContent = "flex-start";
    }

    queriesMade++;

    let query = message;
    if (contextMessage) {
      query += " " + contextMessage;
    }

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
    // console.log("Container ", conversationsContainer);
    // console.log(typeof conversationsContainer);
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

    DOM[$id.LOADING_INDICATOR].style.display = "inline";

    resetUserQuery();
    clearDocumentsContainer();
  }

  async function displayMessage(message: string, sender: string) {
    const ollamaImg = await ollamaImgPromise;

    const messageElement = document.createElement("div");
    messageElement.className =
      sender === "user" ? "user-message" : "ai-message clearBackground";

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
    DOM[$id.CONVERSATION].appendChild(messageElement);
    DOM[$id.CONVERSATION].scrollTop = DOM[$id.CONVERSATION].scrollHeight;

    updateConversationContainer();
  }

  function parseAIResponse(aiResponse: string) {
    if (typeof aiResponse !== "string") {
      vscode.postMessage({
        command: "logError",
        text: `Invalid response message: \nReceived:${typeof aiResponse} | Expected a string.`,
      });
      return;
    }

    const aiMessage = document.createElement("div");
    aiMessage.className = "ai-message";

    // Split the response by code blocks
    const parts = aiResponse.split(/```(?:[\w-]+)?\n?/);

    if (parts.length > 1) {
      parts.forEach((part, index) => {
        if (index % 2 === 0) {
          // Text content
          if (part.trim()) {
            const textContainer = document.createElement("div");
            textContainer.className = "text-container";
            const highlightedText = part.replace(
              /`([^`]+)`/g,
              '<span class="highlightText">$1</span>'
            );
            textContainer.innerHTML = highlightedText.trim();
            // textContainer.innerText = part.trim();
            aiMessage.appendChild(textContainer);
          }
        } else {
          // Code content
          const codeContainer = document.createElement("div");
          codeContainer.className = "code-container";

          const clipboardIcon = document.createElement("span");
          clipboardIcon.className = "clipboard-icon";
          clipboardIcon.innerHTML = copySvgIcon;
          clipboardIcon.onclick = () => copyToClipboard(part.trim());

          const codeBlock = document.createElement("pre");
          codeBlock.innerText = `\n${part.trim()}`;

          codeContainer.appendChild(clipboardIcon);
          codeContainer.appendChild(codeBlock);
          aiMessage.appendChild(codeContainer);
        }
      });

      // Add message options (copy entire message functionality)
      const messageOptions = createMessageOptions(aiMessage);
      aiMessage.appendChild(messageOptions);

      DOM[$id.CONVERSATION].appendChild(aiMessage);
      DOM[$id.CONVERSATION].scrollTop = DOM[$id.CONVERSATION].scrollHeight;

      updateConversationContainer();
    } else {
      // If no code block, display the entire response as regular text
      const highlightedText = aiResponse.replace(
        /`([^`]+)`/g,
        '<span class="highlightText">$1</span>'
      );
      displayMessage(highlightedText, "ai");
    }

    // Hide loading indicator
    DOM[$id.LOADING_INDICATOR].style.display = "none";
  }

  function createMessageOptions(aiMessage: HTMLDivElement) {
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

    const clipboardIcon = document.createElement("span");
    clipboardIcon.className = "clipboard-icon-messages";
    clipboardIcon.innerHTML = copySvgIcon;

    clipboardIconContainer.appendChild(clipboardIcon);

    const messageOptions = document.createElement("div");
    messageOptions.className = "message-options";
    messageOptions.appendChild(clipboardIconContainer);

    return messageOptions;
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
          // parseAndDisplayResponse(message.response);
          parseAIResponse(message.response);
          break;
        case "fileSelected":
          const fileName = message.fileName;
          const fileContent = message.content;
          const filePath = message.fullFileName;
          if (message.embeddedDoc) {
            documentsToEmbed.push({
              fileName: fileName,
              fileContent: fileContent,
              filePath: filePath,
            });

            updateEmbeddedDocumentsUI();
          } else {
            documentsAppendedToQuery.push({
              fileName: fileName,
              fileContent: fileContent,
              filePath: filePath,
            });

            updateAppendedDocumentsUI();
          }
          break;
        case "updateChatHistory":
          if (!conversationsContainer || !conversationsContainer.size) {
            console.warn(
              "Conversation container is undefined or empty. ",
              conversationsContainer
            );
            return;
          }
          // console.log("update chat history:", selectedUUID);
          if (conversationsContainer.has(selectedUUID)) {
            let data = conversationsContainer.get(selectedUUID);
            if (data) {
              data.lastUpdatedTime = Date.now();
              data.conversationLog = message.chatHistory;
              conversationsContainer.set(selectedUUID, data);
            }
          }

          /* console.log(
            "Conversation container pre save: ",
            conversationsContainer
          ); */
          saveData();
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
              if (DOM[$id.RECENT_CHATS_CONTAINER]) {
                // Iterate over each child of recentChatsContainer
                const children = DOM[$id.RECENT_CHATS_CONTAINER].children;
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
          DOM[$id.RECENT_CHATS_CONTAINER].innerHTML = "";
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
