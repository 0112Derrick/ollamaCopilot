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
