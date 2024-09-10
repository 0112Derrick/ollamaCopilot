const HTML_IDS = {
  SEND_BUTTON: "sendButton",
  SEARCH_BAR: "userQuery",
  LOADING_INDICATOR: "loadingIndicator",
  SIDEBAR_CLOSE_BUTTON: "sideBarCloseButton",
  OPEN_SIDE_PANEL_BUTTON: "openSidePanelBtn",
  CONVERSATION: "conversation",
  RECENT_CHATS_CONTAINER: "chatsContainer",
  APPENDED_DOCUMENTS_CONTAINER: "appendedDocumentsContainer",
  NEW_CHAT_WINDOW_BUTTON: "newChatButton",
  ADD_FILE_BUTTON: "addFileButton",
  CONTAINER: "container",
  SETTINGS_BUTTON: "settingsButton",
  SETTINGS_MENU_CLOSE_BUTTON: "settingMenuCloseButton",
  THEME_TOGGLE: "themeToggle",
  PROMPT_BAR: "promptBar",
};

for (let prop in HTML_IDS) {
  Object.defineProperty(HTML_IDS, prop as keyof typeof HTML_IDS, {
    configurable: false,
    writable: false,
  });
}

export { HTML_IDS };
