import * as vscode from 'vscode';

import { GoogleGenerativeAI } from '@google/generative-ai';

// Provide instructions for the AI language model
// This approach uses a few-shot technique, providing a few examples.
const CODE_LABEL = 'Here is the code:';
const EXPLANATION_LABEL = 'Here is a good explanation:';
const PROMPT = `
You are tasked with analyzing and explaining the provided code snippet to child. Your explanation should cover the purpose of the code, its functionality, and any important concepts or techniques used. and the explanation should not exceed more than 300 words
`;


export async function generateExplanation() {
    vscode.window.showInformationMessage('Generating explanation...');

    const modelName = vscode.workspace.getConfiguration().get<string>('google.gemini.textModel', 'models/gemini-1.0-pro-latest');

    // Get API Key from local user configuration
    const apiKey = vscode.workspace.getConfiguration().get<string>('google.gemini.apiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('API key not configured. Check your settings.');
        return;
    }

    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({model: modelName});

    // Text selection
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        console.debug('Abandon: no open text editor.');
        return;
    }

    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);

    // Build the full prompt using the template.
    const fullPrompt = `${PROMPT}

${CODE_LABEL}
${selectedCode}
${EXPLANATION_LABEL}
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const comment = response.text();  

    const findPrefix = await model.generateContent(`find the programming language comment prefix for this code ${selectedCode} and give response like this example : "//", I just want the comment symbol nothing more`);
    const res = await findPrefix.response;
    const prefix = res.text();
    // Insert before selection.
    editor.edit((editBuilder) => {
        // TODO(you!): Support other comment styles.
        const commentPrefix = prefix;

        // Copy the indent from the first line of the selection.
        const trimmed = selectedCode.trimStart();
        const padding = selectedCode.substring(0, selectedCode.length - trimmed.length);

        let pyComment = comment.split('\n').map((l: string) => `${padding}${commentPrefix}${l}`).join('\n');
        if (pyComment.search(/\n$/) === -1) {
            // Add a final newline if necessary.
            pyComment += "\n";
        }
        let commentIntro = padding + commentPrefix + "Code comment: (generated)\n";
        editBuilder.insert(selection.start, commentIntro);
        editBuilder.insert(selection.start, pyComment);
    });
}
