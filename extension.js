// @ts-check
'use strict';


const vscode = require('vscode');


const COMMENT_PATTERNS = new Map([
	['coffeescript',     '#'],
	['dockercompose',    '#'],
	['dockerfile',       '#'],
	['elixir',           '#'],
	['gdscript',         '#'],
	['ignore',           '#'],
	['julia',            '#'],
	['makefile',         '#'],
	['perl',             '#'],
	['powershell',       '#'],
	['python',           '#'],
	['r',                '#'],
	['raku',             '#'],
	['ruby',             '#'],
	['shellscript',      '#'],
	['ssh_config',       '#'],
	['yaml',             '#'],

	['html',             '<!--'],
	['markdown',         '<!--'],
	['php',              '<!--'],
	['razor',            '<!--'],
	['xml',              '<!--'],
	['xsl',              '<!--'],

	['ada',              '--|/\\*'],
	['lua',              '--|/\\*'],
	['haskell',          '--|/\\*'],
	['sql',              '--|/\\*'],
	['sqlite',           '--|/\\*'],

	['bibtex',           '%'],
	['erlang',           '%'],
	['latex',            '%'],
	['matlab',           '%'],
	['tex',              '%'],

	['gdresource',       ';'],
	['gdscene',          ';'],
	['ini',              ';'],
	['properties',       ';'],

	['fsharp',           '//'],
	['shaderlab',        '//'],

	['bat',              '@[rR][eE][mM]'],

	['css',              '/\\*'],

	['clojure',          ';;'],

	['handlebars',       '{{!--'],

	['jade',             '//-'],

	['ocaml',            '\\(\\*'],

	['prolog',           '%|/\\*'],

	['restructuredtext', '..'],

	['vb',               '\''],
]);


// Helpers


/**
 * @returns {Promise<RegExp | null>}
 */
async function createRegExp(json)
{
	// String from another command in this script or from user settings JSON
	if (typeof json === 'string') {
		try {
			return new RegExp(json);
		}
		catch (error) {
			vscode.window.showErrorMessage(error.message);
			return null;
		}
	}
	// Undefined because of the command palette
	else if (json === undefined) {
		const string = await vscode.window.showInputBox({ prompt: 'Regular expression for alignment' });
		if (string === undefined)
			return null;
		try {
			return new RegExp(string);
		}
		catch (error) {
			vscode.window.showErrorMessage(error.message);
			return null;
		}
	}
	// Non-string from user settings JSON
	else {
		vscode.window.showErrorMessage(`Expected a string arg but got: ${JSON.stringify(json)}`);
		return null;
	}
}


// Commands


function alignAssignmentOperators()
{
	alignCustomPattern(' = ');
}


function alignComments()
{
	// Get the editor or fail
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No editor');
		return;
	}

	// Get the comment pattern
	let pattern = COMMENT_PATTERNS.get(editor.document.languageId);
	if (pattern === undefined)
		pattern = '/[/*]';

	alignCustomPattern(pattern);
}


/**
 * @param pattern {string | undefined}
 */
async function alignCustomPattern(possiblePatternString)
{
	// Make the pattern a regular expression or finish
	/** @type {RegExp | null} */
	const pattern = await createRegExp(possiblePatternString);
	if (pattern === null)
		return;

	// Get the editor or fail
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No editor');
		return;
	}

	const document   = editor.document;
	const selections = editor.selections;

	// Get the selected ranges or the whole document
	/** @type {vscode.Range[]} */
	const ranges = [];
	/** @type {Set<number>} */
	// If there's only a simple cursor, then use the whole document
	if (selections.length === 1 && selections[0].isEmpty) {
		if (document.lineCount < 2) {
			vscode.window.showErrorMessage('Document should have multiple lines');
			return;
		}
		const lastLine = document.lineCount - 1;
		const lastChar = document.lineAt(lastLine).range.end.character;
		ranges.push(new vscode.Range(0, 0, lastLine, lastChar));
	}
	// Get each selected range
	else {
		const lines = new Set();
		for (const selection of selections) {
			// If it's a simple cursor, then use the whole line
			if (selection.isEmpty) {
				const line = selection.start.line;
				const lastChar = document.lineAt(line).range.end.character;
				if (lines.has(line)) {
					vscode.window.showErrorMessage(`Only 1 selection per line is allowed (line ${line + 1})`);
					return;
				}
				lines.add(line);
				ranges.push(new vscode.Range(line, 0, line, lastChar));
			}
			// Otherwise, use the selection
			else {
				for (let line = selection.start.line; line < selection.end.line + 1; line++) {
					if (lines.has(line)) {
						vscode.window.showErrorMessage(`Only 1 selection per line is allowed (line ${line + 1})`);
						return;
					}
					lines.add(line);
				}
				ranges.push(new vscode.Range(selection.start, selection.end));
			}
		}
		if (lines.size < 2) {
			vscode.window.showErrorMessage('Multiple lines must be selected');
			return;
		}
	}

	// Find each position of the matches
	/** @type {vscode.Position[]} */
	const positions = [];
	let rightmostChar = -1;
	// Each line in the selection(s)
	for (const range of ranges) {
		for (let line = range.start.line; line < range.end.line + 1; line++) {
			const fullText = document.lineAt(line).text;
			// Get the selected part
			/** @type {string} */
			let selectedText;
			let selectionStartChar = 0;
			if (range.start.line === range.end.line) {
				selectedText = fullText.substring(range.start.character, range.end.character);
				selectionStartChar = range.start.character;
			}
			else if (line === range.start.line) {
				selectedText = fullText.substring(range.start.character);
				selectionStartChar = range.start.character;
			}
			else if (line === range.end.line) {
				selectedText = fullText.substring(0, range.end.character);
			}
			else {
				selectedText = fullText;
			}
			// Find the pattern or skip
			const matches = pattern.exec(selectedText);
			if (!matches)
				continue;
			const char = matches.index + selectionStartChar;
			if (char > rightmostChar)
				rightmostChar = char;
			positions.push(new vscode.Position(line, char))
		}
	}

	// Fail if multiple matches weren't found
	if (positions.length === 0) {
		vscode.window.showErrorMessage(`No matches found for pattern ${pattern}`);
		return;
	}
	else if (positions.length === 1) {
		vscode.window.showErrorMessage(`Only 1 match found for pattern ${pattern}`);
		return;
	}

	// Make the edits on each line
	const editOptions = { undoStopBefore: false, undoStopAfter: false };
	for (const position of positions) {
		// Skip if the match is already at the rightmost character
		const spaceCount = rightmostChar - position.character;
		if (spaceCount < 1)
			continue;
		// Insert spaces
		await editor.edit(function (textEditorEdit) {
			textEditorEdit.insert(position, ' '.repeat(spaceCount));
		}, editOptions);
	}
}


// Main


function activate(context)
{
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'alignAnything.alignAssignmentOperators', alignAssignmentOperators),
		vscode.commands.registerCommand(
			'alignAnything.alignComments',            alignComments),
		vscode.commands.registerCommand(
			'alignAnything.alignCustomPattern',       alignCustomPattern),
	);
}


function deactivate()
{}


module.exports = {
	activate,
	deactivate
}
