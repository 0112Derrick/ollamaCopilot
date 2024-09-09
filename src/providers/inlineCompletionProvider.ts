import * as vscode from "vscode";

class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private inlineSuggestion: string = "";
  private currentChunkPos: number = 0;
  private chunks: string[] = [];

  setInlineSuggestion(text: string) {
    this.inlineSuggestion = text;
    this.currentChunkPos = 0;
    this.chunks = this.splitIntoChunks(text);
  }

  clearInlineSuggestion() {
    this.inlineSuggestion = "";
    this.chunks = [];
    this.currentChunkPos = 0;
  }

  private splitIntoChunks(code: string): string[] {
    // Split by line and keep track of current chunk
    const lines = code.split("\n");
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    lines.forEach((line, index) => {
      // Add line to the current chunk
      currentChunk.push(line);
      console.log(`Chunk ${index} set to: ${line}`);
      // Check for logical breakpoints
      if (
        line.trim().endsWith("{") || // Start of a block (class, function, if, loop)
        line.trim() === "}" || // End of a block
        line.trim().endsWith(";") || // End of a statement
        line.trim().startsWith("//") // Comment line (can be considered a logical breakpoint)
      ) {
        // If we reached a logical breakpoint, save the current chunk
        chunks.push(currentChunk.join("\n"));
        currentChunk = []; // Reset for the next chunk
      }
    });

    // Add any remaining lines as a chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
    }

    return chunks;
  }

  // Method to compare and detect if the suggestion was accepted
  public wasSuggestionAccepted(text: string): boolean {
    if (
      this.chunks.length &&
      this.currentChunkPos < this.chunks.length &&
      this.currentChunkPos >= 0
    ) {
      return text.trim().includes(this.chunks[this.currentChunkPos].trim());
    }
    return false;
  }

  public clearSuggestionOnEscape() {
    this.clearInlineSuggestion();
    vscode.commands.executeCommand("editor.action.inlineSuggest.hide");
  }

  public showNextSuggestion() {
    this.currentChunkPos += 1;
  }

  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<
    vscode.InlineCompletionItem[] | vscode.InlineCompletionList
  > {
    if (token.isCancellationRequested) {
      console.log("Suggestion was canceled or rejected");
      this.clearInlineSuggestion();
      return [];
    }

    if (this.chunks.length > 0 && this.currentChunkPos < this.chunks.length) {
      const currentLine = document.lineAt(position.line);
      const lineText = currentLine.text.trim();
      const cursorPosition = position.character;

      // Determine the insertion position
      let insertPosition = position;
      let rangeToReplace = new vscode.Range(position, position);

      if (lineText.startsWith("//")) {
        // Line is a comment, insert on the next line
        const nextLineNumber = position.line + 1;
        const nextLinePosition = new vscode.Position(nextLineNumber, 0);

        // Create a new line
        insertPosition = currentLine.range.end;
        rangeToReplace = new vscode.Range(insertPosition, insertPosition);
        return [
          {
            insertText: "\n" + this.chunks[this.currentChunkPos],
            range: rangeToReplace,
          },
        ];
      } else if (lineText !== "") {
        // There's non-comment text on the line
        const openBracketIndex = lineText.lastIndexOf("(", cursorPosition);
        const openCurlyBraceIndex = lineText.lastIndexOf("{", cursorPosition);
        const closeBracketIndex = lineText.indexOf(")", cursorPosition);
        const closeCurlyBraceIndex = lineText.indexOf("}", cursorPosition);
        const openSquareBracketIndex = lineText.lastIndexOf(
          "[",
          cursorPosition
        );
        const closeSquareBracketIndex = lineText.indexOf("]", cursorPosition);

        if (
          (openBracketIndex !== -1 &&
            closeBracketIndex !== -1 &&
            openBracketIndex < cursorPosition &&
            cursorPosition < closeBracketIndex) ||
          (openCurlyBraceIndex !== -1 &&
            closeCurlyBraceIndex !== -1 &&
            openCurlyBraceIndex < cursorPosition &&
            cursorPosition < closeCurlyBraceIndex) ||
          (openSquareBracketIndex !== -1 &&
            closeSquareBracketIndex !== -1 &&
            openSquareBracketIndex < cursorPosition &&
            cursorPosition < closeSquareBracketIndex)
        ) {
          // Cursor is inside brackets or braces
          insertPosition = position;
        } else {
          // Insert at the end of the line
          insertPosition = currentLine.range.end;
        }
      }

      rangeToReplace = new vscode.Range(insertPosition, insertPosition);

      return [
        {
          insertText: this.chunks[this.currentChunkPos],
          range: rangeToReplace,
        },
      ];
    } else {
      this.clearInlineSuggestion();
    }

    return [];
  }
}

const inlineCompletionProvider = new InlineCompletionProvider();
export default inlineCompletionProvider;
