import * as assert from 'assert';
import * as vscode from 'vscode';
import { reverseArrow, parseLine, switchRelation, toggleArrowTokenInArrow, switchString } from '../extension';

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
		// Test with "::"
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

		// Test with "@"
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

		// Test with "."
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

		// Test without relation (with "::")
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

		// Test with indent
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
		assert.strictEqual(toggleArrowTokenInArrow('-->', 13, 13), `-->`);
		assert.strictEqual(toggleArrowTokenInArrow('-->', 16, 13), '-->');
		assert.strictEqual(toggleArrowTokenInArrow('-->', 15, 13), '--[norank]>');
		assert.strictEqual(toggleArrowTokenInArrow('-->', 14, 13), '-[norank]->');
		assert.strictEqual(toggleArrowTokenInArrow('--[norank]->', 14, 13), '--[hidden]->');
		assert.strictEqual(toggleArrowTokenInArrow('--[hidden]->', 14, 13), '--->');
		assert.strictEqual(toggleArrowTokenInArrow('<--', 14, 13), `<[norank]--`);
	});

	test('switchString Function', () => {
		const testCases = [
			{
				input: 'A::B "label1" --> "label2" C::D : relation',
				cursorPos: 21, //            ^
				expected: 'C::D "label2" <-- "label1" A::B : relation'
			},
			{
				input: 'A@B "label1" --> "label2" C@D : relation',
				cursorPos: 10, // ^
				expected: 'C@D "label2" <-- "label1" A@B : relation'
			},
			{
				input: '    A@B "label1" --> "label2" C@D : relation',
				cursorPos: 10, // ^
				expected: '    C@D "label2" <-- "label1" A@B : relation'
			},
			{
				input: 'A.B "label1" --> "label2" C.D : relation',
				cursorPos: 13, //    ^
				expected: 'C.D "label2" <-- "label1" A.B : relation'
			},
			{
				input: 'ClassA "name" --|> ClassB::Type : extends',
				cursorPos: 18, //         ^
				expected: 'ClassB::Type <|-- "name" ClassA : extends'
			},
			{
				input: 'ClassA "name" --|> ClassB::Type : extends',
				cursorPos: 15, //      ^
				expected: 'ClassA "name" -[norank]-|> ClassB::Type : extends'
			},
			{
				input: 'ClassA "name" -[norank]-|> ClassB::Type : extends',
				cursorPos: 15, //      ^
				expected: 'ClassA "name" -[hidden]-|> ClassB::Type : extends'
			},
			{
				input: 'ClassA "name" -[hidden]-|> ClassB::Type : extends',
				cursorPos: 19, //         ^
				expected: 'ClassA "name" --|> ClassB::Type : extends'
			},
			{
				input: 'ClassA "name" -[hidden]-|> ClassB::Type : extends',
				cursorPos: 31, //                      ^
				expected: 'ClassB::Type <|-[hidden]- "name" ClassA : extends'
			},
			{
				input: 'ClassA "name" -[hidden]-|> ClassB::Type : extends',
				cursorPos: 15, //      ^
				expected: 'ClassA "name" --|> ClassB::Type : extends'
			},
			{
				input: '    ClassA "name" -[norank]-|> ClassB::Type : extends',
				cursorPos: 19, //          ^
				expected: '    ClassA "name" -[hidden]-|> ClassB::Type : extends'
			}
		];

		testCases.forEach(({ input, cursorPos, expected }) => {
			assert.strictEqual(switchString(input, cursorPos), expected);
		});
	});
});
