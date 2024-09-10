export function isValidJson(str: string): boolean {
  try {
    if (str.trim() === "") {
      return false;
    }
    // Replace single quotes with double quotes, if needed
    const normalizedStr = str.replace(/'/g, '"');

    // Try to parse the normalized string
    JSON.parse(normalizedStr);
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

const aiTrigger = "//ai";
export const COMMANDS = {
  aiTrigger: aiTrigger,
  clearSuggestionsCommand: `${aiTrigger} clear`,
  restoreSuggestions: `${aiTrigger} restore`,
  aiResponseMenuTrigger: "/",
};
