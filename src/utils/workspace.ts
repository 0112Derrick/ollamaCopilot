import vscode from "vscode";
import fs from "fs"; // Add fs module for directory check
import path from "path";
import * as xml2js from "xml2js";
import {
  testingPackages,
  supportedLanguagesExtensions,
} from "../constants/directories";

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
    const isDirectory = stats.isDirectory();

    if (isDirectory) {
      await analyzeFolder(fullPath); // Recursively analyze folders
    }

    for (let extension of supportedLanguagesExtensions) {
      if (!isDirectory && fullPath.endsWith(extension)) {
        // Read file content and count lines
        const fileContent = fs.readFileSync(fullPath, "utf8");
        const lineCount = fileContent.split("\n").length;
        // Store the document's line count in the map
        documents.push({ documentName: fullPath, lineCount: lineCount });
        break;
      }
    }
  }
}

// Define a type for the dependencies object in package.json
type Dependencies = { [packageName: string]: string };

// Define the structure of what readManifest will return
type PackageJSONData = {
  dependencies: Dependencies;
  devDependencies?: Dependencies;
  type: "package.json";
};
type phpData = {
  dependencies: string[];
  devDependencies?: string[];
  type: "composer.json";
};

// If it's a Gradle file, it will return an array of strings (dependencies)
type GradleData = { dependencies: string[]; type: "build.gradle" };
type rustData = { dependencies: string[]; type: "cargo.toml" };
type pythonData = { dependencies: string[]; type: "requirements.txt" };
type javaPomData = { dependencies: string[]; type: "pom.xml" };
type CsprojData = { dependencies: string[]; type: "csproj" };

type singleDependencyArr = { dependencies: string[] };

type ManifestData =
  | PackageJSONData
  | GradleData
  | phpData
  | pythonData
  | rustData
  | javaPomData
  | CsprojData;

type ManifestType =
  | "package.json"
  | "build.gradle"
  | "pom.xml"
  | "composer.json"
  | "cargo.toml"
  | "requirements.txt"
  | "csproj";

function getProjectManifest(workspaceFolder: vscode.WorkspaceFolder): {
  type: ManifestType;
  path: string;
} | null {
  const packageJsonPath = path.join(workspaceFolder.uri.fsPath, "package.json");
  const pythonReqPath = path.join(
    workspaceFolder.uri.fsPath,
    "requirements.txt"
  );
  const phpPath = path.join(workspaceFolder.uri.fsPath, "composer.json");
  const javaPomPath = path.join(workspaceFolder.uri.fsPath, "pom.xml");
  const javaGradlePath = path.join(workspaceFolder.uri.fsPath, "build.gradle");
  const rustPath = path.join(workspaceFolder.uri.fsPath, "cargo.tml");
  const csprojPath = path.join(workspaceFolder.uri.fsPath, "*.csproj");

  if (fs.existsSync(packageJsonPath)) {
    return { type: "package.json", path: packageJsonPath };
  } else if (fs.existsSync(javaGradlePath)) {
    return { type: "build.gradle", path: javaGradlePath };
  } else if (fs.existsSync(javaPomPath)) {
    return { type: "pom.xml", path: javaPomPath };
  } else if (fs.existsSync(phpPath)) {
    return { type: "composer.json", path: phpPath };
  } else if (fs.existsSync(rustPath)) {
    return { type: "cargo.toml", path: rustPath };
  } else if (fs.existsSync(pythonReqPath)) {
    return { type: "requirements.txt", path: pythonReqPath };
  } else {
    // Search for .csproj files in the directory
    const files = fs.readdirSync(workspaceFolder.uri.fsPath);
    const csprojFile = files.find((file) => file.endsWith(".csproj"));

    if (csprojFile) {
      return {
        type: "csproj",
        path: path.join(workspaceFolder.uri.fsPath, csprojFile),
      };
    } else {
      return null;
    }
    return null;
  }
}

// Read manifest logic
function readManifest(
  manifestPath: string,
  type: ManifestType
): Promise<ManifestData> {
  return new Promise((resolve, reject) => {
    fs.readFile(manifestPath, "utf8", (err, data) => {
      if (err) {
        return reject(err);
      }
      console.log("Manifest type: ", type);
      switch (type) {
        case "package.json":
          const packageJson = JSON.parse(data);
          let obj: PackageJSONData = {
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            type: "package.json",
          };
          resolve(obj);
          break;

        case "composer.json":
          const composerJson = JSON.parse(data);
          resolve({
            dependencies: composerJson.require || {},
            devDependencies: composerJson["require-dev"] || {},
            type: "composer.json",
          });
          break;

        case "build.gradle":
          resolve({
            dependencies: extractGradleDependencies(data),
            type: "build.gradle",
          });
          break;

        case "requirements.txt":
          resolve({
            dependencies: extractRequirementsTxtDependencies(data),
            type: "requirements.txt",
          });
          break;

        case "pom.xml":
          resolve({
            dependencies: extractMavenDependencies(data),
            type: "pom.xml",
          });
          break;

        case "cargo.toml":
          resolve({
            dependencies: extractCargoDependencies(data),
            type: "cargo.toml",
          });
          break;

        case "csproj":
          resolve({
            dependencies: extractCsprojDependencies(data),
            type: "csproj",
          });
          break;

        default:
          reject(new Error("Unsupported manifest type"));
      }
    });
  });
}

function extractGradleDependencies(gradleContent: string): string[] {
  const dependencies: string[] = [];
  const dependencyRegex = /testImplementation ['"]([\w\.\-]+)['"]/g;
  let match;
  while ((match = dependencyRegex.exec(gradleContent)) !== null) {
    dependencies.push(match[1]);
  }
  return dependencies;
}

// Rust: Extract dependencies from Cargo.toml
function extractCargoDependencies(tomlContent: string): string[] {
  const dependencyRegex =
    /\[dependencies\]|\[dev-dependencies\]\n([\s\S]*?)(\n\n|\Z)/g;
  const dependencies: string[] = [];
  let match;
  while ((match = dependencyRegex.exec(tomlContent)) !== null) {
    const lines = match[1].split("\n");
    lines.forEach((line) => {
      const parts = line.split("=");
      if (parts.length > 1) {
        dependencies.push(parts[0].trim());
      }
    });
  }
  return dependencies;
}

// Java: Extract dependencies from pom.xml (simple regex)
function extractMavenDependencies(xmlContent: string): string[] {
  const dependencyRegex =
    /<dependency>[\s\S]*?<groupId>([\s\S]*?)<\/groupId>[\s\S]*?<artifactId>([\s\S]*?)<\/artifactId>[\s\S]*?<\/dependency>/g;
  const dependencies: string[] = [];
  let match;
  while ((match = dependencyRegex.exec(xmlContent)) !== null) {
    dependencies.push(`${match[1]}:${match[2]}`);
  }
  return dependencies;
}

// Python: Extract dependencies from requirements.txt
function extractRequirementsTxtDependencies(content: string): string[] {
  const lines = content.split("\n");
  const dependencies = lines
    .map((line) => line.split("==")[0].trim())
    .filter(Boolean);
  return dependencies;
}

function extractCsprojDependencies(xmlContent: string): string[] {
  const dependencies: string[] = [];
  const parser = new xml2js.Parser();
  parser.parseString(xmlContent, (err: any, result: any) => {
    if (err) {
      throw new Error("Error parsing .csproj file");
    }

    // Traverse the XML to find <PackageReference> nodes
    const packageReferences = result.Project.ItemGroup.flatMap(
      (group: any) =>
        group.PackageReference?.map((ref: any) => ref.$.Include) || []
    );
    dependencies.push(...packageReferences);
  });
  return dependencies;
}

// Correcting the usage of readManifest
export async function checkForTestingPackages(): Promise<void | string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder is open.");
    return;
  }

  const workspace = workspaceFolders[0];
  const manifest = getProjectManifest(workspace);

  if (manifest) {
    try {
      const manifestData = await readManifest(manifest.path, manifest.type);

      if (
        manifestData.type === "package.json" ||
        manifestData.type === "composer.json"
      ) {
        const allDependencies = {
          ...manifestData.dependencies,
          ...(manifestData.devDependencies || {}),
        };

        const foundTestingPackages = testingPackages.filter((pkg) =>
          allDependencies.hasOwnProperty(pkg)
        );

        if (foundTestingPackages.length > 0) {
          vscode.window.showInformationMessage(
            `Found testing packages: ${foundTestingPackages.join(", ")}`
          );
          return foundTestingPackages.join(", ");
        } else {
          vscode.window.showInformationMessage(
            "No known testing packages found."
          );
        }
      } else if (
        manifest.type === "build.gradle" ||
        manifest.type === "csproj" ||
        manifest.type === "requirements.txt" ||
        manifest.type === "pom.xml" ||
        manifest.type === "cargo.toml"
      ) {
        const dependenciesData = manifestData as singleDependencyArr;
        vscode.window.showInformationMessage(
          `Found testing library dependencies: ${dependenciesData.dependencies.join(
            ", "
          )}`
        );
        return dependenciesData.dependencies.join(", ");
      } else {
        console.error(
          `Unrecognized manifest type: ${manifest.type} \n workspace.ts/checkForTestingPackages`
        );
        return;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading manifest: ${error}`);
    }
  } else {
    vscode.window.showErrorMessage("No project manifest found.");
  }
}
