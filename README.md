# gyp-converter

A node module (with no dependency on python) for parsing a gyp file and converting the file data into a javascript object

## Usage

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

```
var gc = require("gyp-converter");
var gypConverter = new gc();
var gypObject = gypConverter.parseBindingGyp(path/to/gyp/file/including/your_gyp_file_name.gyp);
```