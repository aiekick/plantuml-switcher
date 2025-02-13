import * as assert from 'assert';
import * as vscode from 'vscode';
import { reverseArrow, parseLine, switchLine } from '../extension';

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
			fromBlock: 'A.B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C.D',
			relationName: 'relation'
		});

		// Test without relation (using "::")
		const resultRelationLess = parseLine('A::B "label1" --> "label2" C::D');
		assert.deepStrictEqual(resultRelationLess, {
			fromBlock: 'A::B',
			fromLabel: 'label1',
			arrow: '-->',
			toLabel: 'label2',
			toBlock: 'C::D',
			relationName: ''
		});
	});

	test('switchLine Function', () => {
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
			assert.strictEqual(switchLine(input), expected);
		});
	});
});
