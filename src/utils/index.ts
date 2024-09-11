export function isValidJson(str: string, reviver?: any): boolean {
  try {
    if (str.trim() === "") {
      return false;
    }

    // First, try to parse the string as-is
    try {
      const normalizedStr = str.replace(/'/g, '"'); // Convert single quotes to double quotes if needed
      JSON.parse(normalizedStr);
      return true;
    } catch (e) {
      // If parsing fails, proceed with fixes
    }

    // Fix JSON structure
    let fixedStr = fixJsonStructure(str);

    // Handle HTML content if present
    if (fixedStr.includes("conversationHtml")) {
      return true;
    }

    // Parse the fixed string
    if (reviver) {
      JSON.parse(fixedStr, reviver);
    } else {
      JSON.parse(fixedStr);
    }
    return true;
  } catch (e) {
    console.error("Error parsing JSON:", e);
    let fixedStr = fixJsonStructure(str);

    // Handle HTML content if present
    if (fixedStr.includes("conversationHtml")) {
      fixedStr = escapeHtmlInJson(fixedStr);
    }
    locateJsonError(fixedStr);
    return false;
  }
}

export function locateJsonError(jsonString: string): void {
  try {
    JSON.parse(jsonString);
  } catch (e) {
    if (e instanceof SyntaxError) {
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const position = parseInt(match[1], 10);
        const start = Math.max(0, position - 20);
        const end = Math.min(jsonString.length, position + 20);
        console.error("Error near position", position);
        console.error("Surrounding context:");
        console.error(jsonString.slice(start, end));
        console.error(" ".repeat(position - start) + "^");
      }
    }
    console.error(e);
  }
}

function escapeHtmlInJson(jsonString: string): string {
  return jsonString.replace(/"conversationHtml":"(.*?)"/gs, (match, p1) => {
    const escaped = p1
      .replace(/\\/g, "\\\\") // Escape backslashes
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, "\\n") // Escape newlines
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/\t/g, "\\t") // Escape tabs
      .replace(/\f/g, "\\f") // Escape form feeds
      .replace(/</g, "\\u003C") // Escape <
      .replace(/>/g, "\\u003E") // Escape >
      .replace(/&/g, "\\u0026"); // Escape &
    return `"conversationHtml":"${escaped}"`;
  });
}

function fixJsonStructure(jsonString: string): string {
  // Fix trailing commas in objects and arrays
  jsonString = jsonString.replace(/,\s*([\]}])/g, "$1");

  // Ensure all property names are double-quoted
  jsonString = jsonString.replace(/(\w+)(?=\s*:)/g, '"$1"');

  // Ensure all string values are double-quoted
  jsonString = jsonString.replace(
    /:(?:\s*)(?!("|\{|\[|true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?))([^,}\]]+)/g,
    ':"$4"'
  );

  // Fix unquoted control characters
  jsonString = jsonString.replace(/\\([^"\\\/bfnrtu])/g, "\\\\$1");

  return jsonString;
}
