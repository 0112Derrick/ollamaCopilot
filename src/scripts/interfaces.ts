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

export type VectorDatabase = {
  getSimilarQueries: (
    query: string,
    minMatch?: number | undefined
  ) => Promise<string>;
};

export interface ModelResponse {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done_reason: string;
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}
