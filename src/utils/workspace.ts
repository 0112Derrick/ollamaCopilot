import vscode from "vscode";
export const getWorkSpaceId = () => {
  const workspaceId = vscode.workspace.workspaceFile
    ? vscode.workspace.workspaceFile.fsPath // for multi-root workspaces
    : vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders[0].uri.fsPath // for single-folder workspaces
    : null;

  console.log("Workspace Unique ID:", workspaceId);
  return workspaceId;
};
