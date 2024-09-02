export function isValidJson(str: string): boolean {
  try {
    if (str.trim() === "") {
      return false;
    }
    JSON.parse(str);
    return true;
  } catch (e) {
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
