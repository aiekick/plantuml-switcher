# plantuml-switcher

**plantuml-switcher** is a Visual Studio Code extension designed to simplify editing PlantUML relation lines. It allows you to quickly reverse the direction of an arrow and swap the source and target parts of a PlantUML relation—all by placing your cursor on the line and pressing the assigned key.

## Features

- **Switch PlantUML Relations:**  
  Automatically reverse the arrow direction and swap the source and target blocks in a PlantUML relation.
  
- **Quick Keybinding:**  
  Simply place your cursor on the line you want to switch and press the configured key (default is `²`).

- **Easy to Use:**  
  Works out-of-the-box without any additional configuration.

## Requirements

- Visual Studio Code version **1.88.0** or later.

## Extension Settings

This extension works with its default settings and does not require any additional configuration.  
*Note: In previous iterations, a setting for the namespace operator was considered, but the current version operates solely based on the syntax of the PlantUML line.*

## Known Issues

- No known issues at the moment. If you encounter any bugs or unexpected behavior, please open an issue on the repository.

## Usage

1. Open a any file in Visual Studio Code with PlantUml content.
2. Place your cursor on a line containing a PlantUML relation, for example:  
   `A::B "label1" --> "label2" C::D : relation`
3. Press the key bound to the command (default key: `²`).
4. The extension will automatically switch the line to:  
   `C::D "label2" <-- "label1" A::B : relation`

## Release Notes

### 1.0.0

- Initial release of plantuml-switcher.
- Added functionality to switch PlantUML relation lines.

### 1.0.1

- Insert [norank], [hidden] or nothing when the cursor in on the link cyclically

**Enjoy switching your PlantUML relations with ease!**
