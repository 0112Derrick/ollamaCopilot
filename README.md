# ollama-copilot README

This extension integrates AI capabilities into VS Code, providing intelligent code suggestions, detecting boilerplate code, and offering inline completions. It also includes a Webview interface for user interactions with the AI, enhancing coding efficiency and productivity.

## Installation

Remote:
Install [Ollama](https://ollama.com/) on dedicated machine and configure endpoint to it in extension settings. Ollama usually uses port 11434 and binds to 127.0.0.1, to change it you should set OLLAMA_HOST to 0.0.0.0.

Running a forwarding server on host machine:
Ctrl+Shift+P or Cmd+Shift+P: Change ollama url to HostMachine.ip.address:port e.g: http://192.168.1.100:3000/forward
Requirement: Node installed on host machine.
npm install the dependencies of the forwarding server.
Run the server.
(Javascript | axios | cors)
[Forwarding sever](./proxy-server.js)

Local:
Install [Ollama](https://ollama.com) on local machine and then launch the extension in VSCode, everything should work as it is.

Github: [Ollama Github](https://github.com/ollama/ollama)

## Recommend Hardware

Minimum required RAM: 10GB is a minimum, more is better since even the smallest model takes 5GB of RAM. The best way: dedicated machine with RTX 4090. Install [Ollama](https://ollama.com) on this machine and configure endpoint in extension settings to offload to this machine. Second best way: run on MacBook M1/M2/M3 with enough RAM (more == better, but 10gb+ would be enough). For windows notebooks: it runs well with a decent GPU, but dedicated machine with a good GPU is recommended. Perfect if you have a dedicated gaming PC. If your hardware has less than 10gb ram then we recommend you connect the app to OpenAI. OpenAI URL: `https://api.openai.com/v1/chat/completions`, model: `gpt-4o-mini`, you will need to set your headers to `Authorization:Bearer *$OPENAI_API_KEY*`.

## Features

Ollama webview

<!-- ![media](media/features/ollamaWebview.png) -->

Directly interact with whatever model you are running by using the webview from the chat extension.

Extension supports inline suggestions from models:

<!-- ![media](media/features/inlinePrompt.png) -->

- The app will scan your current document routinely helping to auto complete code.
- If you have an embed model set and an embed url the app will scan your current document and after 50 newlines of code is added to the current document it will re-embed that document.
- You can drag and drop in new documents and they will be embedded as a part of your current workspace.
- In the webview you can change the apps theme, add documents to embed, and set a custom system prompt.

`Commands:`
`Ctrl+Shift+P | CMD+Shift+P:`
`Set Ollama Headers`
`Set Ollama Model`
`Set Ollama Url`
`Reset Ollama Url | Model | Headers`
`Ollama: uninstall`
`Ollama workspace: Clear all saved embedded data for the current workspace.`

`Right Click Commands (Highlight code):`
`Offer a suggestion on how to improve this code.`
`Refactor this code.`
`Tell me about this code.`
`Write a unit test for this code.`
`Debug this code.`
`Embed this code.`

> Tip: Smaller models may not understand the instructions needed to have the extension work properly. Recommended model is llama3.1 or higher.

## Requirements

A working server that will listen to post commands at the set url. This server should return string JSON in order for the application to process it correctly.

By default the app will listen to `http://localhost:11434/api/generate` because this is the default port of Ollama.

By default the app will use `llama3.1` for the model name in the request.

## Extension Settings

`contributes.configuration`.

This extension contributes the following settings:

- `Set Ollama URL`: Sets where the api request will go to. This is useful if you want to host the model on a separate machine or use a server in the middle of your requests. By default set to `http://localhost:11434/api/generate`
- `Set Ollama Model`: Sets the model name included in the request. By default set to: `llama3.1`
- `Set Ollama Headers`: Sets the api headers sent in the post request during queries.

> If you switch your embedding model it is recommended to also re-embed your workspace for the best results.

## Known Issues

- Right clicking and prompting ollama does not always open the web view and execute the prompt on the first attempt.
- Suggestion does not clear out after accepting it.
- Graphical issue with the webview prompt bar.

## Uninstalling

- Press Cmd + shift + p or Ctrl + shift + p type Ollama: uninstall. This will wipe all saved data by the extension. It is important to do this step before uninstalling the extension because the extension saves your embedded workspaces and vscode will not remove this data if you uninstall the app normally.

## Troubleshooting

- If you are getting an error it most likely means your model is not running or your extension settings are not pointed to your correct model / url.

- Most issues should have an error message pop up and detail the problem.

## Changelog

### 0.0.5

Initial release of Ollama copilot

## Contributing

Ollama_copilot is open-source under the MIT license. See the [LICENSE](./LICENSE) for more details.

**Enjoy!**
