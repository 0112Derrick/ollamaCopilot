import vscode from "vscode";
import fs from "fs"; // Add fs module for directory check
import path from "path";

export const getWorkSpaceId = () => {
  const workspaceId = vscode.workspace.workspaceFile
    ? vscode.workspace.workspaceFile.fsPath // for multi-root workspaces
    : vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders[0].uri.fsPath // for single-folder workspaces
    : null;

  const activeEditor = vscode.window.activeTextEditor;
  const activeDocument = activeEditor ? activeEditor.document.uri.fsPath : null;

  console.log("Workspace Unique ID:", workspaceId);
  console.log("Active Document Path:", activeDocument);

  return { workspaceId, activeDocument };
};

const documents: { documentName: string; lineCount: number }[] = [];

export async function analyzeWorkspaceDocuments() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace is open.");
    return;
  }

  for (const workspaceFolder of workspaceFolders) {
    const folderPath = workspaceFolder.uri.fsPath;
    await analyzeFolder(folderPath);
  }
  return documents;
}

async function analyzeFolder(folderPath: string) {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const fullPath = path.join(folderPath, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      await analyzeFolder(fullPath); // Recursively analyze folders
    } else if (
      fullPath.endsWith(".ts") ||
      fullPath.endsWith(".js") ||
      fullPath.endsWith(".py") ||
      fullPath.endsWith(".java") ||
      fullPath.endsWith(".c") ||
      fullPath.endsWith(".cpp") ||
      fullPath.endsWith(".cs") ||
      fullPath.endsWith(".go") ||
      fullPath.endsWith(".rb") ||
      fullPath.endsWith(".php") ||
      fullPath.endsWith(".swift") ||
      fullPath.endsWith(".kt") ||
      fullPath.endsWith(".rs") ||
      fullPath.endsWith(".html") ||
      fullPath.endsWith(".hbs") ||
      fullPath.endsWith(".handlebars") ||
      fullPath.endsWith(".css") ||
      fullPath.endsWith(".scss") ||
      fullPath.endsWith(".sass") ||
      fullPath.endsWith(".less") ||
      fullPath.endsWith(".styl") ||
      fullPath.endsWith(".vue") ||
      fullPath.endsWith(".jsx") ||
      fullPath.endsWith(".tsx")
    ) {
      // Read file content and count lines
      const fileContent = fs.readFileSync(fullPath, "utf8");
      const lineCount = fileContent.split("\n").length;
      // Store the document's line count in the map
      documents.push({ documentName: fullPath, lineCount: lineCount });
    }
  }
}
