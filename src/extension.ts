import * as vscode from 'vscode';
import * as assert from 'assert';

const ARROW_CHARS = new Set(['<', '>', '-', '.', '[', ']', '|', 'o', '*', '\\', '/', '+', '#', '^']);
const ARROW_TOGGLE_OPTIONS = ["", "norank", "hidden"];

export function isArrowBlock(block: string): boolean {
    let inBrackets = false;
    for (const char of block) {
        if (char === '[') {
            inBrackets = true;
            continue;
        } else if (char === ']') {
            inBrackets = false;
            continue;
        } else if (!inBrackets && !ARROW_CHARS.has(char)) {
            return false;
        }
    }
    return (block !== "");
}

export function findArrow(line: string): { arrow: string; index: number } | null {
    const blocks = line.split(/\s+/);
    if (blocks) {
        for (const token of blocks) {
            if (isArrowBlock(token)) {
                return { arrow: token, index: line.indexOf(token) };
            }
        }
    }
    return null;
}

export function reverseArrow(arrow: string): string {
    const tokens: string[] = [];
    let currentToken = '';
    let inBrackets = false;
    for (let i = 0; i < arrow.length; i++) {
        const char = arrow[i];
        if (char === '[') {
            if (currentToken) { tokens.push(currentToken); }
            currentToken = '[';
            inBrackets = true;
        } else if (char === ']') {
            currentToken += ']';
            tokens.push(currentToken);
            currentToken = '';
            inBrackets = false;
        } else {
            currentToken += char;
        }
    }
    if (currentToken) {
        tokens.push(currentToken);
    }
    tokens.reverse();
    const reversedTokens = tokens.map(token => {
        if (token.startsWith('[') && token.endsWith(']')) {
            return token;
        } else {
            return [...token]
                .reverse()
                .map(ch => (ch === '<' ? '>' : ch === '>' ? '<' : ch))
                .join('');
        }
    });
    return reversedTokens.join('');
}

function findIndent(line: string): string {
    const matches = line.match("^(( |\t)*)");
    if (matches) {
        return matches[0];
    }
    return "";
}

export interface ParsedLine {
    indent: string;
    fromBlock: string;
    fromLabel: string;
    arrow: string;
    toLabel: string;
    toBlock: string;
    relationName: string;
}

export function parseLine(line: string): ParsedLine | null {
    const arrowInfo = findArrow(line);
    if (!arrowInfo) {
        return null;
    }
    const arrow = arrowInfo.arrow;
    const arrowPos = arrowInfo.index;
    const indent = findIndent(line);
    const beforeArrow = line.substring(0, arrowPos).trim();
    const afterArrow = line.substring(arrowPos + arrow.length).trim();
    let mainPart = afterArrow;
    let relationName = "";
    const relSep = " : ";
    const relIndex = afterArrow.indexOf(relSep);
    if (relIndex !== -1) {
        mainPart = afterArrow.substring(0, relIndex).trim();
        relationName = afterArrow.substring(relIndex + relSep.length).trim();
    }
    let fromBlock = beforeArrow;
    let fromLabel = "";
    const firstQuoteIndex = beforeArrow.indexOf('"');
    const lastQuoteIndex = beforeArrow.lastIndexOf('"');
    if (firstQuoteIndex !== -1 && lastQuoteIndex !== firstQuoteIndex) {
        fromLabel = beforeArrow.substring(firstQuoteIndex + 1, lastQuoteIndex).trim();
        fromBlock = beforeArrow.substring(0, firstQuoteIndex).trim();
    }
    let toBlock = mainPart;
    let toLabel = "";
    if (mainPart.startsWith('"')) {
        const secondQuoteIndex = mainPart.indexOf('"', 1);
        if (secondQuoteIndex !== -1) {
            toLabel = mainPart.substring(1, secondQuoteIndex).trim();
            toBlock = mainPart.substring(secondQuoteIndex + 1).trim();
        }
    }
    return {
        indent,
        fromBlock,
        fromLabel,
        arrow,
        toLabel,
        toBlock,
        relationName
    };
}

export function switchRelation(line: string): string {
    const parsed = parseLine(line);
    if (!parsed) {
        return line;
    }
    const { indent, fromBlock, fromLabel, arrow, toLabel, toBlock, relationName } = parsed;
    const switchedArrow = reverseArrow(arrow);
    let result = `${indent}${toBlock}`;
    if (toLabel) {
        result += ` "${toLabel}"`;
    }
    result += ` ${switchedArrow}`;
    if (fromLabel) {
        result += ` "${fromLabel}"`;
    }
    result += ` ${fromBlock}`;
    if (relationName) {
        result += ` : ${relationName}`;
    }
    return result;
}

export function toggleArrowTokenInArrow(arrow: string, cursorOffset: number, arrowOffset: number): string {
    const localOffset = cursorOffset - arrowOffset;
    if (localOffset === 0.0 || arrow.length === localOffset) {
        return arrow;
    }
    const nonEmptyTokens = ARROW_TOGGLE_OPTIONS.filter(token => token !== "");
    const escapedTokens = nonEmptyTokens.map(token =>
        token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    );
    const pattern = escapedTokens.join("|");
    const regex = new RegExp(`\\[(${pattern})\\]`);
    const match = arrow.match(regex);
    if (match) {
        const currentToken = match[1];
        const currentIndex = ARROW_TOGGLE_OPTIONS.indexOf(currentToken);
        const nextIndex = (currentIndex + 1) % ARROW_TOGGLE_OPTIONS.length;
        const nextToken = ARROW_TOGGLE_OPTIONS[nextIndex];
        if (nextToken === "") {
            return arrow.replace(regex, "");
        }
        return arrow.replace(regex, `[${nextToken}]`);
    }
    return arrow.slice(0, localOffset) + `[${ARROW_TOGGLE_OPTIONS[1]}]` + arrow.slice(localOffset);
}

export function switchString(line: string, cursorPos: number): string | null {
    const arrowInfo = findArrow(line);
    if (!arrowInfo) {
        return null;
    }
    const arrowStart = arrowInfo.index;
    const arrowEnd = arrowInfo.index + arrowInfo.arrow.length;
    if (cursorPos > arrowStart && cursorPos < arrowEnd) {
        const toggledArrow = toggleArrowTokenInArrow(arrowInfo.arrow, cursorPos, arrowStart);
        return line.substring(0, arrowStart) + toggledArrow + line.substring(arrowEnd);
    }
    return switchRelation(line);
}
export function switchText(document: vscode.TextDocument, selection: vscode.Selection): { newText: string, range: vscode.Range } {
    let range: vscode.Range;
    let textToTransform: string;
    let relativeSelection: vscode.Selection;
    if (selection.isEmpty) { // cursor mode => row inversion, or arrow inversion according to cursor position
        const lineNumber = selection.start.line;
        const lineInfo = document.lineAt(lineNumber);
        textToTransform = lineInfo.text;
        const cursorPos = selection.active.character - lineInfo.range.start.character;
        relativeSelection = new vscode.Selection(0, cursorPos, 0, cursorPos);
        range = lineInfo.range;
    } else { // selection mode. at least one character is selected across one or more lines => row inversion
        const startLine = selection.start.line;
        const endLine = selection.end.line;
        const startChar = 0;
        const endChar = document.lineAt(endLine).text.length;
        range = new vscode.Range(startLine, startChar, endLine, endChar);
        textToTransform = document.getText(range);
        // Create a non-empty relative selection to trigger row inversion on all lines.
        relativeSelection = new vscode.Selection(0, 0, 0, 1);
    }
    const lines = textToTransform.split(/\r?\n/);
    if (relativeSelection.isEmpty) { // cursor mode
        const cursorPos = relativeSelection.active.character;
        const newLine = switchString(lines[0], cursorPos);
        lines[0] = newLine ?? lines[0];
    } else { // selection mode
        for (let i = 0; i < lines.length; i++) {
            lines[i] = switchRelation(lines[i]);
        }
    }
    return { newText: lines.join("\n"), range };
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('plantuml-switcher.relation', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const { newText, range } = switchText(editor.document, editor.selection);
        editor.edit(editBuilder => {
            editBuilder.replace(range, newText);
        });
    });
    context.subscriptions.push(disposable);
}


export function deactivate() { }
