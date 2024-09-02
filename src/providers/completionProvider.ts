import * as vscode from "vscode";

class MyCompletionItemProvider implements vscode.CompletionItemProvider {
  private completionItems: vscode.CompletionItem[] = [];
  private previousSuggestions: vscode.CompletionItem[] = [];

  addNewCompletionItem(label: string, item: string) {
    const _item = new vscode.CompletionItem(
      item,
      vscode.CompletionItemKind.Snippet
    );
    _item.detail = label + " " + item;

    this.completionItems.push(_item);
  }

  clearSuggestions(): void {
    this.previousSuggestions = [...this.completionItems];
    this.completionItems = [];
  }

  restoreSuggestions(): boolean {
    if (this.previousSuggestions.length === 0) {
      return false;
    }

    this.completionItems = [...this.previousSuggestions];
    this.previousSuggestions = [];
    return true;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    return this.completionItems;
  }
}

const completionProvider = new MyCompletionItemProvider();
export default completionProvider;



/* {
  "name": "ghost-text-completion",
  "displayName": "Ghost Text Completion",
  "description": "Provides inline ghost text completions",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": [
    "Other"
  ],
  "activationEvents": [
    "onLanguage:javascript",
    "onLanguage:typescript"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": []
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/vscode": "^1.60.0",
    "@types/node": "^14.14.37",
    "typescript": "^4.3.5"
  }
} */
