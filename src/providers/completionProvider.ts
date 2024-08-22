import * as vscode from "vscode";

class MyCompletionItemProvider implements vscode.CompletionItemProvider {
  public completionItems: vscode.CompletionItem[] = [];

  addNewCompletionItem(label: string, item: string) {
    const _item = new vscode.CompletionItem(
      item,
      vscode.CompletionItemKind.Snippet
    );
    _item.detail = label + " " + item;

    this.completionItems.push(_item);
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
