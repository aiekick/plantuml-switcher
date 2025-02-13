import * as vscode from 'vscode';
import * as assert from 'assert';

const ARROW_CHARS = new Set([
    '<', '>', '-', '.', '[', ']', '|', 'o', '*', '\\', '/', '+', '#', '^'
]);

export function isArrowBlock(block: string): boolean {
    let inBrackets = false;
    for (const char of block) {
        if (char === '[') {
            inBrackets = true;
            continue;
        }
        if (char === ']') {
            inBrackets = false;
            continue;
        }
        if (!inBrackets && !ARROW_CHARS.has(char)) {
            return false;
        }
    }
    return true;
}

/**
 * Searches for the arrow in the line.
 * Returns the object { arrow, index } where index is the position
 * of the arrow's occurrence in the string.
 */
export function findArrow(line: string): { arrow: string; index: number } | null {
    const blocks = line.split(/\s+/);
    for (const token of blocks) {
        if (isArrowBlock(token)) {
            return { arrow: token, index: line.indexOf(token) };
        }
    }
    return null;
}

/**
 * Reverses the arrow while taking into account the segments between brackets.
 * For example:
 *   "-->"         becomes "<--"
 *   "--|>"        becomes "<|--"
 *   "--[norank]->" becomes "<-[norank]--"
 *   "-[#red]-[bold]->" becomes "<-[bold]-[#red]-"
 */
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
    if (currentToken) { tokens.push(currentToken); }

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

export interface ParsedLine {
    fromBlock: string;
    fromLabel: string;
    arrow: string;
    toLabel: string;
    toBlock: string;
    relationName: string;
}

/**
 * Analyzes a line in the following format:
 *
 *    <fromBlock> [<fromLabel>] <arrow> [<toLabel>] <toBlock> [ : <relationName>]
 *
 * For example:
 *
 *    A::B "label1" --> "label2" C::D : relation
 *
 * The function splits the line into three parts:
 *  - The source part (before the arrow): if it ends with a label in quotes,
 *    that label is extracted and the remainder forms the source block.
 *  - The target part (after the arrow): if it starts with a label in quotes,
 *    that label is extracted and the remainder forms the target block.
 *  - The relation (after " : ") if present.
 */
export function parseLine(line: string): ParsedLine | null {
    // Locate the arrow in the line.
    const arrowInfo = findArrow(line);
    if (!arrowInfo) { return null; }
    const arrow = arrowInfo.arrow;
    const arrowPos = arrowInfo.index;

    // Split the line into two parts: before and after the arrow.
    const beforeArrow = line.substring(0, arrowPos).trim();
    const afterArrow = line.substring(arrowPos + arrow.length).trim();

    // In the part after the arrow, search for the relation separator " : "
    let mainPart = afterArrow;
    let relationName = "";
    const relSep = " : ";
    const relIndex = afterArrow.indexOf(relSep);
    if (relIndex !== -1) {
        mainPart = afterArrow.substring(0, relIndex).trim();
        relationName = afterArrow.substring(relIndex + relSep.length).trim();
    }

    // Extract the source part:
    // If the part before the arrow ends with a label in quotes,
    // extract it and the remainder is the source block.
    let fromBlock = beforeArrow;
    let fromLabel = "";
    const firstQuoteIndex = beforeArrow.indexOf('"');
    const lastQuoteIndex = beforeArrow.lastIndexOf('"');
    if (firstQuoteIndex !== -1 && lastQuoteIndex !== firstQuoteIndex) {
        fromLabel = beforeArrow.substring(firstQuoteIndex + 1, lastQuoteIndex).trim();
        fromBlock = beforeArrow.substring(0, firstQuoteIndex).trim();
    }

    // Extract the target part:
    // If the main part starts with a label in quotes,
    // extract it and the remainder is the target block.
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
        fromBlock,   // for example "A::B"
        fromLabel,   // for example "label1"
        arrow,       // for example "-->"
        toLabel,     // for example "label2"
        toBlock,     // for example "C::D"
        relationName // for example "relation"
    };
}

/**
 * Returns the "switched" line by swapping the source and target,
 * and reversing the arrow.
 *
 * For example, the line
 *
 *   A::B "label1" --> "label2" C::D : relation
 *
 * becomes
 *
 *   C::D "label2" <-- "label1" A::B : relation
 */
export function switchLine(line: string): string {
    const parsed = parseLine(line);
    if (!parsed) { return line; }
    const { fromBlock, fromLabel, arrow, toLabel, toBlock, relationName } = parsed;
    const switchedArrow = reverseArrow(arrow);

    let result = toBlock;
    if (toLabel) {
        result += ` "${toLabel}"`;
    }
    result += ` ${switchedArrow} `;
    if (fromLabel) {
        result += `"${fromLabel}" `;
    }
    result += fromBlock;
    if (relationName) {
        result += ` : ${relationName}`;
    }
    return result.trim();
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('plantuml-switcher.relation', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line);
        const newText = switchLine(line.text);

        editor.edit(editBuilder => {
            editBuilder.replace(line.range, newText);
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
