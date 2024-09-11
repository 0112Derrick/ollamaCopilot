import { MessageRoles } from "../providers/webViewProvider";
export type ChatContainer = Map<
  string,
  {
    lastUpdatedTime: number;
    conversationHtml: string;
    conversationLog: { role: MessageRoles; content: string }[];
    label: string;
    queriesMade: number;
  }
>;

export type OllamaWebviewThemes =
  | "light"
  | "dark"
  | "rose-gold"
  | "high-contrast"
  | "pokemon-theme";
