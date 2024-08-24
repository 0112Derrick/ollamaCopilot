import axios from "axios";

export const llama3 = {
  maxToken: 4096,
  name: "llama3",
};

export const defaultURL = "http://localhost:11434/api/generate";

export async function generateChatCompletion(
  query: string,
  model: string = llama3.name,
  url: string = defaultURL,
  headers: { [key: string]: string } = {},
  stream: boolean = false
) {
  try {
    const config = { headers };

    const data_ = {
      model,
      prompt: query,
      stream: stream,
    };

    for (let i = 0; i < 3; i++) {
      const response = await axios.post(url, data_, config);
      if (
        response.data.response === null ||
        (response.data.response && typeof response.data.response === "string")
      ) {
        return response.data.response;
      }
    }

    return "Unable to receive JSON in the correct format after multiple attempts.";
  } catch (error) {
    console.error("Error generating chat completion:", error);
    return "Error connecting to the server.";
  }
}
