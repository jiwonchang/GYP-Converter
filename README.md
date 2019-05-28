# gyp-converter

A node module (with no dependency on python) for parsing a gyp file and converting the file data into a javascript object

## Usage

Instruction on how to use the gyp-converter:

```
var gc = require("gyp-converter");
var gypConverter = new gc();
var gypObject = gypConverter.parseBindingGyp(path/to/gyp/file/including/your_gyp_file_name.gyp);
```

By the end, you should have the gyp file data as a Javascript object (accessible through the variable gypObject).