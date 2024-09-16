const LOCAL_STORAGE_KEYS = {
  OLLAMA_MODEL: "ollamaModel",
  IS_OPENAI_MODEL: "openAiModel",
  OLLAMA_EMBED_MODEL: "ollamaEmbedModel",
  OLLAMA_CHAT_COMPLETION_URL: "ollamaURLChat",
  OLLAMA_EMBED_URL: "ollamaEmbedURL",
  OLLAMA_HEADERS: "ollamaHeaders",
  CHAT_HISTORY_STORAGE_KEY: "ollama_copilot_chat_state",
  THEME_PREFERENCE_KEY: "ollama_copilot_theme_preference",
  VECTOR_DATABASE_KEY: "ollama_copilot_workspace_",
  WORKSPACE_DOCUMENTS_KEY: "ollama_copilot_workspace_documents",
  USER_SYSTEM_PROMPT_KEY: "ollama_copilot_user_system_prompt",
};

for (let prop in LOCAL_STORAGE_KEYS) {
  Object.defineProperty(
    LOCAL_STORAGE_KEYS,
    prop as keyof typeof LOCAL_STORAGE_KEYS,
    {
      configurable: false,
      writable: false,
    }
  );
}

export { LOCAL_STORAGE_KEYS };
