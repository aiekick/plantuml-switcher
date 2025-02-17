import * as vscode from 'vscode';
import * as assert from 'assert';

const ARROW_CHARS = new Set([
    '<', '>', '-', '.', '[', ']', '|', 'o', '*', '\\', '/', '+', '#', '^'
]);

const ARROW_TOGGLE_OPTIONS = ["", "norank", "hidden"];


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
 * Recherche la flèche dans la ligne.
 * Renvoie { arrow, index } où index correspond à la position d'apparition.
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
 * Inverse la flèche en tenant compte des segments entre crochets.
 * Par exemple :
 *   "-->"         devient "<--"
 *   "--|>"        devient "<|--"
 *   "--[norank]->" devient "<-[norank]--"
 *   "-[#red]-[bold]->" devient "<-[bold]-[#red]-"
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
 * Analyse une ligne au format :
 *
 *    <fromBlock> [<fromLabel>] <arrow> [<toLabel>] <toBlock> [ : <relationName>]
 *
 * Par exemple :
 *
 *    A::B "label1" --> "label2" C::D : relation
 */
export function parseLine(line: string): ParsedLine | null {
    const arrowInfo = findArrow(line);
    if (!arrowInfo) { return null; }
    const arrow = arrowInfo.arrow;
    const arrowPos = arrowInfo.index;

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
        fromBlock,
        fromLabel,
        arrow,
        toLabel,
        toBlock,
        relationName
    };
}

/**
 * Retourne la ligne "switchée" en échangeant source et cible et en inversant la flèche.
 *
 * Par exemple, la ligne
 *
 *   A::B "label1" --> "label2" C::D : relation
 *
 * devient
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

export function toggleArrowTokenInArrow(arrow: string, cursorOffset: number, arrowOffset: number): string {
    const localOffset = cursorOffset - arrowOffset; 
    if (localOffset === 0.0 || arrow.length === localOffset){
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
        // Si un token est déjà présent, on passe au suivant dans le cycle.
        const currentToken = match[1];
        const currentIndex = ARROW_TOGGLE_OPTIONS.indexOf(currentToken);
        const nextIndex = (currentIndex + 1) % ARROW_TOGGLE_OPTIONS.length;
        const nextToken = ARROW_TOGGLE_OPTIONS[nextIndex];
        if (nextToken === "") {
            // On supprime le token.
            return arrow.replace(regex, "");
        } else {
            // On remplace par le token suivant.
            return arrow.replace(regex, `[${nextToken}]`);
        }
    } else {
        // Aucun token n'est présent : insertion du premier token non vide
        // à la position du curseur (offset relatif dans la flèche).
        return arrow.slice(0, localOffset) + `[${ARROW_TOGGLE_OPTIONS[1]}]` + arrow.slice(localOffset);
    }
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('plantuml-switcher.relation', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const position = editor.selection.active;
        const lineInfo = editor.document.lineAt(position.line);
        const line = lineInfo.text;
        const arrowInfo = findArrow(line);
        if (!arrowInfo) {
            return;
        }
        const arrowStart = arrowInfo.index;
        const arrowEnd = arrowInfo.index + arrowInfo.arrow.length;

        let newText: string;
        // Si le curseur est sur la flèche, on toggle le token.
        if (position.character > arrowStart && position.character < arrowEnd) {
            const toggledArrow = toggleArrowTokenInArrow(arrowInfo.arrow, position.character, arrowStart);
            newText = line.substring(0, arrowStart) + toggledArrow + line.substring(arrowEnd);
        } else {
            // Sinon, on conserve l'ancien fonctionnement (switch de la relation).
            newText = switchLine(line);
        }

        editor.edit(editBuilder => {
            editBuilder.replace(lineInfo.range, newText);
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
