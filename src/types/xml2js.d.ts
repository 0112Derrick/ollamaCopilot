declare module "xml2js" {
  interface ParserOptions {
    // Define any options the parser can take here if needed
  }

  class Parser {
    constructor(options?: ParserOptions);
    parseString(str: string, callback: (err: any, result: any) => void): void;
  }
}
