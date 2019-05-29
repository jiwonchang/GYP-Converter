/*!

 Dependencies

 */
var fs = require('fs');

function GypConverter() {
    let self = this;
    // we populate and return this object at the end
    self.gypObject = {};
}

// splits the file data and then parses each piece of data accordingly
GypConverter.prototype.parseGyp = function (gypFileDir) {
    let self = this;
    var bindingGypData = fs.readFileSync(gypFileDir).toString();
    let splitBindingGypData = self.lineSplitter(bindingGypData);
    // the data structures stack keeps track of & gives access to immediate parent data structure
    var dataStructsStack = [];
    // the bracket stack keeps track of the parent data structure's type
    var bracketStack = [];
    // if parent is an object, isKey keeps track of whether current element is a key or a value
    self.isKey = false;
    // if parent is an object and if current element is a value, objKey will track the corresponding object key
    self.objKey = null;
    // let objValue = null;

    // Process every kind of element in the split array
    for (let elem of splitBindingGypData) {
        if (elem === '{') {
            self.CreateNewObject(dataStructsStack, bracketStack);
        } else if (elem === '[') {
            self.CreateNewArray(dataStructsStack, bracketStack);
        } else if (elem === '}') {
            self.ProcessClosedBrace(dataStructsStack, bracketStack);
        } else if (elem === ']') {
            self.ProcessClosedBracket(dataStructsStack, bracketStack);
        } else {
            self.ProcessOtherSplitGypElems(elem, dataStructsStack, bracketStack);
        }
    }

    // the below prints out the object in a nice format (for debugging purposes)
    // console.log('\n' + JSON.stringify(self.gypObject, null, 4));
    return self.gypObject;
};

// splits the file data so as to make the data parseable regardless of the format
GypConverter.prototype.lineSplitter = function (arr) {
    let self = this;
    // split the array by newline while also keeping the newline separator
    arr = arr.split(/(\n)/);
    // newArr will contain the split, filtered, and finalized elements of the original 'arr' array
    let newArr = [];
    // lineSplitterHelper breaks down / splits the file data into its most basic elements
    self.lineSplitterHelper(arr, newArr);
    // JoinSplitQuotes joins all the quotes and comments that have been split apart (undesirably) by lineSplitterHelper
    self.JoinSplitQuotes(newArr);
    // FilterArray filters the array to remove all elements that are either comments or found in a pre-defined filter
    newArr = self.FilterArray(newArr);
    return newArr;
};

// helps split every element in an array, then recurses on every (now split) array element in that array
GypConverter.prototype.lineSplitterHelper = function (arr, newArr) {
    let self = this;
    for (let i = 0; i < arr.length; i++) {
        // trim() removes '\n', which is undesirable; we can use '\n' to detect comments
        if (arr[i] !== '\n') {
            arr[i] = arr[i].trim();
        }
        let elem = arr[i];
        // by using the regex /(...)/, we can split the string while also keeping the separator a separate element
        // because we are keeping the separator in the split array, it is important to check if elem == separator
        // otherwise, we get infinite loop (e.g., indexOf(',') in ',' is 0, so splitting will give us [','], and so on)
        if (elem.indexOf(',') >= 0 && elem !== ',') {
            elem = elem.split(/(,)/);
            self.lineSplitterHelper(elem, newArr);
        }
        else if (elem !== '{' && elem.indexOf('{') >= 0) {
            elem = elem.split(/({)/);
            self.lineSplitterHelper(elem, newArr);
        }
        else if (elem !== '[' && elem.indexOf('[') >= 0) {
            elem = elem.split(/(\[)/);
            self.lineSplitterHelper(elem, newArr);
        }
        else if (elem !== '}' && elem.indexOf('}') >= 0) {
            elem = elem.split(/(})/);
            self.lineSplitterHelper(elem, newArr);
        }
        else if (elem !== ']' && elem.indexOf(']') >= 0) {
            elem = elem.split(/(])/);
            self.lineSplitterHelper(elem, newArr);
        }
        else if (elem.indexOf(':') >= 0 && elem !== ':') {
            elem = elem.split(/(:)/);
            self.lineSplitterHelper(elem, newArr);
        }
        else if (elem.indexOf('#') >= 0 && elem !== '#') {
            elem = elem.split(/(#)/);
            self.lineSplitterHelper(elem, newArr);
        }
        else {
            newArr.push(elem);
        }
    }
};

// if the element is an open curly brace, create a new object
GypConverter.prototype.CreateNewObject = function(dataStructsStack, bracketStack) {
    let self = this;
    let newObject = {};
    // if the data structure & bracket stacks are empty, then start the new gyp object
    if (dataStructsStack.length === 0 && bracketStack.length === 0) {
        self.gypObject = newObject;
    }
    else {
        if ((dataStructsStack.length !== bracketStack.length)) {
            throw new Error('THE STACK OF DATA STRUCTURES AND THE STACK OF BRACKETS HAVE UNEQUAL LENGTHS');
        }
        // case: if the parent data structure is an object (then this new object must be an object value)
        if (bracketStack[bracketStack.length - 1] === '{') {
            // if this brace (object) was an object value, then flip the boolean to be isKey=true for the next item
            self.isKey = !self.isKey;
            if (self.isKey) {
                throw new Error('A BRACKET SEEMS TO BE SEEN AS A PROPERTY KEY. SOMETHING WENT WRONG.');
            }
            dataStructsStack[dataStructsStack.length - 1][self.objKey] = newObject;
        }
        // case: if the parent data structure is an array (then this new object must be an element)
        else if (bracketStack[bracketStack.length - 1] === '[') {
            dataStructsStack[dataStructsStack.length - 1].push(newObject);
        }
    }
    // add to the data structure and bracket stack to keep track of parents
    dataStructsStack.push(newObject);
    bracketStack.push('{');
};

// if the element is an open square bracket, create a new array
GypConverter.prototype.CreateNewArray = function(dataStructsStack, bracketStack) {
    let self = this;
    let newArray = [];
    // if the data structure & bracket stacks are empty, then start the new gyp object with... an array?
    // technically, this should not be possible in a gyp file;
    if (dataStructsStack.length === 0 && bracketStack.length === 0) {
        self.gypObject = newArray;
        console.log("AN ARRAY IS THE VERY FIRST DATA STRUCTURE; THIS TECHNICALLY SHOULDN'T HAPPEN");
    }
    else {
        if ((dataStructsStack.length === 0 && bracketStack.length > 0) || (dataStructsStack.length > 0 && bracketStack.length === 0)) {
            throw new Error('THE STACK OF DATA STRUCTURES AND THE STACK OF BRACKETS HAVE UNEQUAL LENGTHS');
        }
        // case: if the parent data structure is an object (then this new array must be an object value)
        if (bracketStack[bracketStack.length - 1] === '{') {
            self.isKey = !self.isKey;
            if (self.isKey) {
                throw new Error('A BRACKET SEEMS TO BE SEEN AS A PROPERTY KEY. SOMETHING WENT WRONG.');
            }
            dataStructsStack[dataStructsStack.length - 1][self.objKey] = newArray;
        }
        // case: if the parent data structure is an array (then this new array must be an element)
        else if (bracketStack[bracketStack.length - 1] === '[') {
            dataStructsStack[dataStructsStack.length - 1].push(newArray);
        }
    }
    // add to the data structure and bracket stack to keep track of parents
    dataStructsStack.push(newArray);
    bracketStack.push('[');
};

// if '}' is encountered, check that parent is an object and then remove parent from stacks
GypConverter.prototype.ProcessClosedBrace = function (dataStructsStack, bracketStack) {
    if (bracketStack[bracketStack.length - 1] !== '{') {
        throw new Error('THE CLOSING BRACKET AND OPENING BRACKET ARE OF DIFFERENT TYPES. THIS IS AWKWARD.');
    }
    dataStructsStack.pop();
    bracketStack.pop();
};

// if ']' is encountered, check that parent is an array and then remove parent from stacks
GypConverter.prototype.ProcessClosedBracket = function (dataStructsStack, bracketStack) {
    if (bracketStack[bracketStack.length - 1] !== '[') {
        throw new Error('THE CLOSING BRACKET AND OPENING BRACKET ARE OF DIFFERENT TYPES. THIS IS AWKWARD.');
    }
    dataStructsStack.pop();
    bracketStack.pop();
};

// process other kinds of elements accordingly
GypConverter.prototype.ProcessOtherSplitGypElems = function (elem, dataStructsStack, bracketStack) {
    let self = this;
    // remove the (single or double) quotation marks around the elements if it has quotation around it
    var elemNoQuotes = (elem.indexOf('"') === 0 || elem.indexOf('\'') === 0) ? elem.slice(1,-1) : elem;
    // if the element is a number, then convert it to be a number
    if (!isNaN(elemNoQuotes)) {
        elemNoQuotes = Number(elemNoQuotes);
    }
    // if parent is an object, determine whether element is a key or a value
    if (bracketStack[bracketStack.length - 1] === '{') {
        self.isKey = !self.isKey;
        if (self.isKey) {
            self.objKey = elemNoQuotes;
        } else {
            dataStructsStack[dataStructsStack.length - 1][self.objKey] = elemNoQuotes;
        }
    }
    // if parent is an array, push the element into the array
    else if (bracketStack[bracketStack.length - 1] === '[') {
        dataStructsStack[dataStructsStack.length - 1].push(elemNoQuotes);
    }
};

// join quotes and comments that may have been split by the lineSplitterHelper function
GypConverter.prototype.JoinSplitQuotes = function (newArr) {
    for (let i = 0; i < newArr.length; i++) {
        let elem = newArr[i];
        // if the first index has a quotation but the last index is not an equal quotation, we have a split quote
        if ((elem[0] === '"' && (elem[elem.length-1] !== '"' || elem.slice(elem.length-2) === '\\"'))
            || (elem[0] === '\'' && (elem[elem.length-1] !== '\'' || elem.slice(elem.length-2) === "\\'"))) {
            // until we find the missing closing quotation mark, keep joining the string elements together
            for (let j = i+1; j < newArr.length; j++) {
                let nextElem = newArr[j];
                if (((elem[0] === '"' && nextElem[nextElem.length-1] !== '"') || nextElem.slice(nextElem.length-2) === '\\"')
                    || ((elem[0] === '\'' && nextElem[nextElem.length-1] !== '\'') || nextElem.slice(nextElem.length-2) === "\\'")) {
                    newArr[i] += newArr[j];
                    newArr.splice(j, 1);
                    j--;
                }
                else {
                    newArr[i] += newArr[j];
                    newArr.splice(j, 1);
                    j--;
                    break;
                }
            }
        }
        // if the first index has a comment symbol but the next element is not newline, then we have a split comment
        else if (elem[0] === '#' && (i+1 < newArr.length && newArr[i+1] !== '\n')) {
            // until we find the newline, keep joining string elements together
            for (let j = i+1; j < newArr.length; j++) {
                let nextElem = newArr[j];

                if (nextElem !== '\n') {
                    newArr[i] += newArr[j];
                    newArr.splice(j, 1);
                    j--;
                }
                else {
                    break;
                }
            }
        }
    }
};

// given a split array, return a filtered array using a defined filter
GypConverter.prototype.FilterArray = function (newArr) {
    let self = this;
    let filteredNewArr = [];
    self.filter = [':', ',', '', '\n'];
    // filter out lone colons and commas from the split array; they are not used
    for (let i = 0; i < newArr.length; i++) {
        let elem = newArr[i];
        if (!self.filter.includes(elem) && elem[0] !== '#') {
            // replace the escaped quote characters with just a quote character
            elem = elem.replace(/\\'/g, "'");
            elem = elem.replace(/\\"/g, '"');
            filteredNewArr.push(elem);
        }
    }
    return filteredNewArr;
};


module.exports  = GypConverter;