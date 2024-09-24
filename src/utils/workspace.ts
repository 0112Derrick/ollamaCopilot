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

type ManifestData =
  | PackageJSONData
  | GradleData
  | phpData
  | pythonData
  | rustData
  | javaPomData;

type ManifestType =
  | "package.json"
  | "build.gradle"
  | "pom.xml"
  | "composer.json"
  | "cargo.toml"
  | "requirements.txt";

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

        case "composer.json":
          const composerJson = JSON.parse(data);
          resolve({
            dependencies: composerJson.require || {},
            devDependencies: composerJson["require-dev"] || {},
            type: "composer.json",
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

      if (manifestData.type === "package.json") {
        const allDependencies = {
          ...manifestData.dependencies,
          ...(manifestData.devDependencies || {}),
        };

        const testingPackages = ["jest", "mocha", "chai", "junit", "pytest"];
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
      } else if (manifest.type === "build.gradle") {
        const gradleData = manifestData as GradleData;
        vscode.window.showInformationMessage(
          `Found Gradle dependencies: ${gradleData.dependencies.join(", ")}`
        );
        return gradleData.dependencies.join(", ");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading manifest: ${error}`);
    }
  } else {
    vscode.window.showErrorMessage("No project manifest found.");
  }
}
