import { LocalIndex, MetadataTypes, QueryResult } from "vectra";
import path from "path";
import {
  defaultEmbedURL,
  llama3,
  openAiEmbedModel,
  openAIEmbedUrl,
} from "../external/ollama";
import fs from "fs"; // Add fs module for directory check
import vscode from "vscode";
import { isValidJson } from "../utils";
import { LOCAL_STORAGE_KEYS as $keys } from "../constants/LocalStorageKeys";
import axios from "axios";

export default class VectraDB {
  private _index: LocalIndex;
  private _model: string;
  private _ollamaHeaders: { [key: string]: string } = {};
  private _ollamaEmbedUrl: string;
  private indexFilePath: string;

  constructor(context: vscode.ExtensionContext) {
    // console.log("Dirname: ", __dirname);
    // Path for the index folder
    const indexPath = path.join(__dirname, "index");
    // console.log("Path :", indexPath);
    // Ensure directory exists
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath, { recursive: true });
    }
    //Setting up vectra vector db data store locally
    this._index = new LocalIndex(indexPath);
    this.indexFilePath = path.join(__dirname, "index", "index.json");

    console.log("File Path to index.json: ", this.indexFilePath);

    const useOpenAI = context.globalState.get<string>($keys.IS_OPENAI_MODEL);

    this._model = context.globalState.get<string>(
      $keys.OLLAMA_EMBED_MODEL,
      useOpenAI ? openAiEmbedModel.name : llama3.name
    );

    const headers = context.globalState.get<string>($keys.OLLAMA_HEADERS, "{}");

    try {
      if (isValidJson(headers)) {
        this._ollamaHeaders = JSON.parse(headers);
      }
    } catch (e) {
      console.error("Error parsing headers: ", e);
    }

    this._ollamaEmbedUrl = context.globalState.get<string>(
      $keys.OLLAMA_EMBED_URL,
      useOpenAI ? openAIEmbedUrl : defaultEmbedURL
    );
  }

  async createIndex() {
    // Ensure directory exists
    if (!(await this._index.isIndexCreated())) {
      await this._index.createIndex();
    }
  }

  //Get vector data for an input using locally run model via ollama
  async getEmbedding(query: string): Promise<number[] | number[][]> {
    const config = {
      headers: { "Content-Type": "application/json", ...this._ollamaHeaders },
    };

    const data_ = {
      model: this._model,
      input: query,
    };

    try {
      const response = await axios.post(this._ollamaEmbedUrl, data_, config);

      type openAiResponse = {
        object: string;
        data: [
          {
            object: string;
            embedding: number[];
            index: number;
          }
        ];
        model: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      };

      type ollamaResponse = {
        model: string;
        embeddings: number[][];
        total_duration: number;
        load_duration: number;
        prompt_eval_count: number;
      };

      type responseType = openAiResponse | ollamaResponse;

      let data: responseType = response.data;

      if ((data as openAiResponse).data) {
        // This is an openAiResponse
        const openAiData = data as openAiResponse;
        console.log(openAiData.data[0].embedding);
        return openAiData.data[0].embedding;
      } else if ((data as ollamaResponse).embeddings) {
        // This is an ollamaResponse
        const ollamaData = data as ollamaResponse;
        console.log(ollamaData.embeddings[0]);
        return ollamaData.embeddings;
      }

      return response.data;
    } catch (error) {
      console.error("Error: " + error);
      vscode.window.showErrorMessage("An error occurred while embedding data.");
      return [];
    }
  }

  // Helper function to split content into chunks
  splitIntoChunks = (lines: string[], chunkSize: number) => {
    const chunks: string[][] = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize));
    }
    return chunks;
  };

  //Add item to vector db
  async addItemToVectorStore(fileContent: string, filePath?: string) {
    const lines = fileContent.split("\n");
    const lineCount = lines.length;

    let data: number[][] = [];
    const chunkSize = 250;

    if (lineCount > chunkSize) {
      // Split lines into chunks of 250 lines
      const chunks = this.splitIntoChunks(lines, chunkSize);

      // Process each chunk
      for (const chunk of chunks) {
        const chunkContent = chunk.join("\n"); // Combine lines back into a string
        const embedding = (await this.getEmbedding(chunkContent)) as number[];
        data.push(embedding); // Aggregate the results
      }
    } else {
      let result = (await this.getEmbedding(fileContent)) as number[];
      data.push(result);
    }

    if (data.length === 0) {
      console.log(
        "Error occurred while retrieving vector data - addingItem Function"
      );
      return;
    }

    if (!filePath) {
      filePath = "";
    }

    if (Array.isArray(data[0])) {
      // Handle the case where data is number[][]
      for (const vector of data as number[][]) {
        await this._index.insertItem({
          vector, // Each vector is an array of numbers (number[])
          metadata: { filePath: filePath, content: fileContent },
        });
      }
    }
  }

  //Query vector vs vector store
  async queryVectorStore(
    fileContent: string,
    matchesLimit: number = 3,
    debug: boolean = false
  ): Promise<QueryResult<Record<string, MetadataTypes>>[] | null[]> {
    const embeddings = (await this.getEmbedding(fileContent)).flat();

    if (embeddings.length === 0) {
      console.log(
        "Error occurred while retrieving vector data - querying item function"
      );
      return [];
    }

    const results = await this._index.queryItems(embeddings, matchesLimit);

    if (debug) {
      results.forEach((result) =>
        console.log(`[${result.score}] ${result.item.metadata.content}`)
      );
    }

    return results;
  }

  async getSimilarQueries(query: string, minMatch?: number) {
    if (!minMatch) {
      minMatch = 0.15;
    }

    let similarQueries = `Similar queries: `;

    await this.createIndex();

    let similarUserQueries = await this.queryVectorStore(
      query.toLowerCase(),
      3
    );

    const set = new Set<number>();

    similarUserQueries.forEach((vector) => {
      if (!vector) {
        return;
      }

      let score = vector.score;

      if (score < 0) {
        score = score * -1;
      }

      let minScore = minMatch;

      console.log(
        "Score:" +
          Number.parseFloat(score.toPrecision(2)) +
          "\nMin score:" +
          minScore +
          `\n result: ${minScore <= Number.parseFloat(score.toPrecision(2))}\n`
      );

      if (
        !set.has(vector.score) &&
        minScore <= Number.parseFloat(score.toPrecision(2))
      ) {
        set.add(vector.score);
        console.log("_______________________");
        console.log(
          `\nScore: [${vector.score}] File content: ${vector.item.metadata.content} File path: ${vector.item.metadata.filePath}\n`
        );

        similarQueries += `File content: ${vector.item.metadata.content}, File path: ${vector.item.metadata.filePath} `;
      }
    });

    return similarQueries;
  }

  async indexWorkspaceDocuments() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace is open.");
      return;
    }
    this.createIndex();

    for (const workspaceFolder of workspaceFolders) {
      const folderPath = workspaceFolder.uri.fsPath;
      await this.indexFolder(folderPath);
    }
  }

  async indexFolder(folderPath: string) {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        await this.indexFolder(fullPath); // Recursively index folders
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
        const fileContent = fs.readFileSync(fullPath, "utf8");
        await this.addItemToVectorStore(fileContent, fullPath); // Vectorize and store
      }
    }
  }

  clearEmbeddingsFile(): void {
    try {
      // Check if the file exists
      if (fs.existsSync(this.indexFilePath)) {
        // Overwrite the file with an empty array (or any structure you use)
        fs.writeFileSync(this.indexFilePath, JSON.stringify({}));
        console.log("Embeddings file cleared.");
      } else {
        console.warn("Embeddings file not found.");
      }
    } catch (error) {
      console.error("Error clearing embeddings file:", error);
    }
  }

  writeEmbeddingsFile(data: {
    version: number;
    metadata_config: {};
    items: {
      id: string;
      metadata: { filePath: string; content: string };
      vector: number[];
    }[];
  }): void {
    try {
      // Convert data to JSON format and write it to index.json
      fs.writeFileSync(this.indexFilePath, JSON.stringify(data));
      console.log("Data successfully written to embeddings file.");
    } catch (error) {
      console.error("Error writing to embeddings file:", error);
    }
  }

  readEmbeddingsFile(): {
    version: number;
    metadata_config: {};
    items: {
      id: string;
      metadata: { filePath: string; content: string };
      vector: number[];
    }[];
  } | null {
    try {
      // Check if the file exists
      if (fs.existsSync(this.indexFilePath)) {
        // Read the content of the file and parse it as JSON
        const data = fs.readFileSync(this.indexFilePath, "utf8");

        return JSON.parse(data);
      } else {
        console.warn("Embeddings file not found.");
        return null;
      }
    } catch (error) {
      console.error("Error reading embeddings file:", error);
      return null;
    }
  }
}
