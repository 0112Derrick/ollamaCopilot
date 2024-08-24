export function isValidJson(str: string): boolean {
  try {
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
