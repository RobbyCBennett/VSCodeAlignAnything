# Align Anything

*Align assignments, comments, or anything else*


## Usage

1. Select some lines
2. Use a command starting with "Align Anything"

Then, the first match on each line is aligned to the right using spaces.


## Features

Ways to select text
- Select multiple lines in one selection
- Create multiple selections with alt and the mouse
- Select nothing and the entire file is aligned

Patterns to find and align
- Assignment operators (`=` surrounded by spaces)
- Comments for 48 different languages (with `//` and `/*` by default)
- Custom patterns
	- Popup if no string is set
	- Set a keybinding with `"args": "regular_expression_here"`


## Known Limitations

- It doesn't work if lines are indented differently with tabs.

- Tokens are not known. As a result, patterns found in strings will be aligned. Tokens that span across lines will not work well either. See https://github.com/microsoft/vscode/issues/177452.
