import { GitExtension } from "@/git";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand("git-add-exclude.hello", () => {
    watchGitAddOperation();
  });
}

export function deactivate() {}

type RepositoryInternalApi = {
  onDidRunOperation: (
    callback: (param: { operation: { kind: string } }) => void
  ) => void;
  stage: (uri: vscode.Uri, stageText: string) => void;
};

function commentRegex(tag: string) {
  return RegExp(`^((\/\/)|(\/\*))[\\*\\s]*${tag}`);
}

function watchGitAddOperation() {
  const gitExtensionApi = vscode.extensions
    .getExtension<GitExtension>("vscode.git")
    ?.exports?.getAPI(1);
  if (gitExtensionApi === undefined) {
    return;
  }

  vscode.window.showInformationMessage("插件启动成功");

  gitExtensionApi.repositories.forEach((repo) => {
    const repository = (repo as any).repository as RepositoryInternalApi;
    repository.onDidRunOperation(({ operation }) => {
      console.log({
        operation,
        kind: operation.kind,
        isequal: operation.kind === "Add",
      });

      if (operation.kind === "Add") {
        const extensionConfig =
          vscode.workspace.getConfiguration("git-add-exclude");

        const blockStartTag = extensionConfig.get<string>(
          "blockStartTag",
          "#git-add-exclude-start"
        );
        const blockEndTag = extensionConfig.get<string>(
          "blockEndTag",
          "#git-add-exclude-end"
        );

        const blockStartTagRegex = commentRegex(blockStartTag)
        const blockEndTagRegex = commentRegex(blockEndTag)

        repo.state.indexChanges.forEach(async (change) => {
          const uri = change.uri;
          const textDocument = await vscode.workspace.openTextDocument(uri);

          const stageText: string[] = [];

          let isWrappedByTag = false;
          for (let line = 0; line < textDocument.lineCount; line++) {
            const lineText = textDocument.getText(
              new vscode.Range(line, 0, line + 1, 0)
            );
            if (blockStartTagRegex.test(lineText.trimStart())) {
              isWrappedByTag = true;
            } else if (blockEndTagRegex.test(lineText.trimStart())) {
              isWrappedByTag = false;
            } else if (!isWrappedByTag) {
              stageText.push(lineText);
            }
          }

          repository.stage(uri, stageText.join(""));
        });
      }
    });
  });
}
