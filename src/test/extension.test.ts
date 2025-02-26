import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	reverseArrow,
	parseLine,
	switchRelation,
	toggleArrowTokenInArrow,
	switchString,
	switchText
} from '../extension';

function createFakeDocument(text: string): vscode.TextDocument {
	const lines = text.split(/\r?\n/);
	return {
		lineCount: lines.length,
		getText: (range?: vscode.Range) => {
			if (!range) { return text; }
			let result: string[] = [];
			for (let i = range.start.line; i <= range.end.line; i++) {
				if (i === range.start.line && i === range.end.line) {
					result.push(lines[i].substring(range.start.character, range.end.character));
				} else if (i === range.start.line) {
					result.push(lines[i].substring(range.start.character));
				} else if (i === range.end.line) {
					result.push(lines[i].substring(0, range.end.character));
				} else {
					result.push(lines[i]);
				}
			}
			return result.join("\n");
		},
		lineAt: (line: number): { text: string; range: vscode.Range } => {
			const textLine = lines[line];
			const range = new vscode.Range(line, 0, line, textLine.length);
			return { text: textLine, range };
		},
		fileName: '',
		isClosed: false,
		version: 1,
		save: () => Promise.resolve(true),
		offsetAt: (_position: vscode.Position) => 0,
		positionAt: (_offset: number) => new vscode.Position(0, 0),
		getWordRangeAtPosition: (_position: vscode.Position) => undefined,
		validateRange: (range: vscode.Range) => range,
		validatePosition: (position: vscode.Position) => position
	} as unknown as vscode.TextDocument;
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('reverseArrow Function', () => {
		assert.strictEqual(reverseArrow('-->'), '<--');
		assert.strictEqual(reverseArrow('--|>'), '<|--');
		assert.strictEqual(reverseArrow('..>'), '<..');
		assert.strictEqual(reverseArrow('--o'), 'o--');
		assert.strictEqual(reverseArrow('-|>'), '<|-');
		assert.strictEqual(reverseArrow('--[norank]->'), '<-[norank]--');
		assert.strictEqual(reverseArrow('-[#red]-[bold]->'), '<-[bold]-[#red]-');
	});

	test('parseLine Function', () => {
		const resultDoubleColon = parseLine('A::B "label1" --> "label2" C::D : relation');
		assert.deepStrictEqual(resultDoubleColon, {
			indent: '',
			fromBlock: 'A::B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C::D',
			relationName: 'relation'
		});

		const resultAt = parseLine('A@B "label1" --> "label2" C@D : relation');
		assert.deepStrictEqual(resultAt, {
			indent: '',
			fromBlock: 'A@B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C@D',
			relationName: 'relation'
		});

		const resultDot = parseLine('A.B "label1" --> "label2" C.D : relation');
		assert.deepStrictEqual(resultDot, {
			indent: '',
			fromBlock: 'A.B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C.D',
			relationName: 'relation'
		});

		const resultRelationLess = parseLine('A::B "label1" --> "label2" C::D');
		assert.deepStrictEqual(resultRelationLess, {
			indent: '',
			fromBlock: 'A::B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C::D',
			relationName: ''
		});

		const resultRelationIndent = parseLine('    A::B "label1" --> "label2" C::D');
		assert.deepStrictEqual(resultRelationIndent, {
			indent: '    ',
			fromBlock: 'A::B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C::D',
			relationName: ''
		});
	});

	test('switchRelation Function', () => {
		const testCases = [
			{
				input: 'A::B "label1" --> "label2" C::D : relation',
				expected: 'C::D "label2" <-- "label1" A::B : relation'
			},
			{
				input: 'A@B "label1" --> "label2" C@D : relation',
				expected: 'C@D "label2" <-- "label1" A@B : relation'
			},
			{
				input: 'A.B "label1" --> "label2" C.D : relation',
				expected: 'C.D "label2" <-- "label1" A.B : relation'
			},
			{
				input: 'ClassA "name" --|> ClassB::Type : extends',
				expected: 'ClassB::Type <|-- "name" ClassA : extends'
			}
		];
		testCases.forEach(({ input, expected }) => {
			assert.strictEqual(switchRelation(input), expected);
		});
	});

	test('toggleArrowTokenInArrow Function', () => {
		assert.strictEqual(toggleArrowTokenInArrow('-->', 13, 13), '-->');
		assert.strictEqual(toggleArrowTokenInArrow('-->', 16, 13), '-->');
		assert.strictEqual(toggleArrowTokenInArrow('-->', 15, 13), '--[norank]>');
		assert.strictEqual(toggleArrowTokenInArrow('-->', 14, 13), '-[norank]->');
		assert.strictEqual(toggleArrowTokenInArrow('--[norank]->', 14, 13), '--[hidden]->');
		assert.strictEqual(toggleArrowTokenInArrow('--[hidden]->', 14, 13), '--->');
		assert.strictEqual(toggleArrowTokenInArrow('<--', 14, 13), '<[norank]--');
	});

	test('switchString Function (cursor mode)', () => {
		const testCases = [
			{
				input: 'A::B "label1" --> "label2" C::D : relation',
				cursorPos: 21,
				expected: 'C::D "label2" <-- "label1" A::B : relation'
			},
			{
				input: 'A@B "label1" --> "label2" C@D : relation',
				cursorPos: 10,
				expected: 'C@D "label2" <-- "label1" A@B : relation'
			},
			{
				input: '    A@B "label1" --> "label2" C@D : relation',
				cursorPos: 10,
				expected: '    C@D "label2" <-- "label1" A@B : relation'
			},
			{
				input: 'A.B "label1" --> "label2" C.D : relation',
				cursorPos: 13,
				expected: 'C.D "label2" <-- "label1" A.B : relation'
			},
			{
				input: 'ClassA "name" --|> ClassB::Type : extends',
				cursorPos: 18,
				expected: 'ClassB::Type <|-- "name" ClassA : extends'
			},
			{
				input: 'ClassA "name" --|> ClassB::Type : extends',
				cursorPos: 15,
				expected: 'ClassA "name" -[norank]-|> ClassB::Type : extends'
			},
			{
				input: 'ClassA "name" -[norank]-|> ClassB::Type : extends',
				cursorPos: 15,
				expected: 'ClassA "name" -[hidden]-|> ClassB::Type : extends'
			},
			{
				input: 'ClassA "name" -[hidden]-|> ClassB::Type : extends',
				cursorPos: 19,
				expected: 'ClassA "name" --|> ClassB::Type : extends'
			},
			{
				input: 'ClassA "name" -[hidden]-|> ClassB::Type : extends',
				cursorPos: 31,
				expected: 'ClassB::Type <|-[hidden]- "name" ClassA : extends'
			},
			{
				input: 'ClassA "name" -[hidden]-|> ClassB::Type : extends',
				cursorPos: 15,
				expected: 'ClassA "name" --|> ClassB::Type : extends'
			},
			{
				input: '    ClassA "name" -[norank]-|> ClassB::Type : extends',
				cursorPos: 19,
				expected: '    ClassA "name" -[hidden]-|> ClassB::Type : extends'
			}
		];
		testCases.forEach(({ input, cursorPos, expected }) => {
			assert.strictEqual(switchString(input, cursorPos), expected);
		});
	});

	test('switchText Cursor mode: empty selection', () => {
		const text = 'A::B "label1" --> "label2" C::D : relation';
		const fakeDoc = createFakeDocument(text);
		// Cursor mode: selection is empty, so only the active line is processed with switchString.
		const selection = new vscode.Selection(new vscode.Position(0, 21), new vscode.Position(0, 21));
		const result = switchText(fakeDoc, selection);
		const expectedLine = switchString(text, 21) ?? text;
		assert.strictEqual(result.newText, expectedLine);
		const expectedRange = fakeDoc.lineAt(0).range;
		assert.strictEqual(result.range.isEqual(expectedRange), true);
	});

	test('switchText Selection mode: one character selected', () => {
		const text = 'A::B "label1" --> "label2" C::D : relation';
		const fakeDoc = createFakeDocument(text);
		// Even if only one character is selected, it triggers selection mode.
		const selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 1));
		const result = switchText(fakeDoc, selection);
		const expectedLine = switchRelation(text);
		assert.strictEqual(result.newText, expectedLine);
	});

	test('switchText Selection mode: multiple lines selected', () => {
		const text = [
			'A::B "label1" --> "label2" C::D : relation',
			'ClassA "name" --|> ClassB::Type : extends',
			'X::Y "foo" --> "bar" Z::W : dependency'
		].join("\n");
		const fakeDoc = createFakeDocument(text);
		// Selection covering multiple lines.
		const selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(2, 1));
		const result = switchText(fakeDoc, selection);
		const expectedLines = [
			switchRelation('A::B "label1" --> "label2" C::D : relation'),
			switchRelation('ClassA "name" --|> ClassB::Type : extends'),
			switchRelation('X::Y "foo" --> "bar" Z::W : dependency')
		];
		const expectedText = expectedLines.join("\n");
		assert.strictEqual(result.newText, expectedText);
	});
});
