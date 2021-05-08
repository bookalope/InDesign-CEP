
/*
 * By default, ExtendScript has no JSON support and so we add it here.
 * See also:
 *  - https://forums.adobe.com/message/9015663#9015663
 *  - https://github.com/douglascrockford/JSON-js
 */

if(typeof JSON!=='object'){JSON={};}(function(){'use strict';function f(n){return n<10?'0'+n:n;}function this_value(){return this.valueOf();}if(typeof Date.prototype.toJSON!=='function'){Date.prototype.toJSON=function(){return isFinite(this.valueOf())?this.getUTCFullYear()+'-'+f(this.getUTCMonth()+1)+'-'+f(this.getUTCDate())+'T'+f(this.getUTCHours())+':'+f(this.getUTCMinutes())+':'+f(this.getUTCSeconds())+'Z':null;};Boolean.prototype.toJSON=this_value;Number.prototype.toJSON=this_value;String.prototype.toJSON=this_value;}var cx,escapable,gap,indent,meta,rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==='string'?c:'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);})+'"':'"'+string+'"';}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}if(typeof rep==='function'){value=rep.call(holder,key,value);}switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==='[object Array]'){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}v=partial.length===0?'[]':gap?'[\n'+gap+partial.join(',\n'+gap)+'\n'+mind+']':'['+partial.join(',')+']';gap=mind;return v;}if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){if(typeof rep[i]==='string'){k=rep[i];v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}if(typeof JSON.stringify!=='function'){escapable=/[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'};JSON.stringify=function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}return str('',{'':value});};}if(typeof JSON.parse!=='function'){cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}return reviver.call(holder,key,value);}text=String(text);cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);});}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}throw new SyntaxError('JSON.parse');};}}());


/*
 * Add "beforeClose" event listener which dispatches an event to the other side
 * that the current documents is being closed; data for that event is the number
 * of currently opened documents. The Bookalope panel will then switch to the
 * Upload view when the last document closes.
 */

app.addEventListener("beforeClose", function(event) {
  try {
    var xLib = new ExternalObject("lib:\PlugPlugExternalObject");
    if (xLib) {
      var csEvent = new CSXSEvent();
      csEvent.type = "documentBeforeClose";
      csEvent.data = app.documents.length;
      csEvent.dispatch();
    }
  }
  catch (e) {
    // We do nothing here. Should we alert the user that dispatching a custom
    // event to the other side failed?
  }
}, false);


/**
 * Gather and return configuration information that's useful for the panel.
 *
 * @returns {string} A JSON stringified dictionary of configuration values.
 */

function getConfiguration() {

    // Gather interesting data into a configuration Object, stringify and return it.
    var config = {
        app: {
            version: app.version,
            user: app.userName,
            win: Folder.fs == "Windows",
        },
        fs: {
            data: Folder.userData.fsName,
            desktop: Folder.desktop.fsName,
            tmp: Folder.temp.fsName,
            separator: Folder.fs == "Windows" ? "\\" : "/",
        },
    };
    return JSON.stringify(config);
}


/**
 * Write the given object to the given document's Bookalope data store.
 *
 * @param {Document} doc - The InDesign document whose data store we want to use.
 * @param {Object} data - An object that's stored into the document's data store.
 */

function bookalopeSetDocumentData(doc, data) {

    // Add the data to the document.
    doc.insertLabel("privateBookalopeDataStore", JSON.stringify(data));
}


/**
 * Add the given key:value pair to the given document's Bookalope data store.
 *
 * @param {Document} doc - The InDesign document whose data store we want to use.
 * @param {string) key - The key by which to find the value in the data store.
 * @param {Object} value - A JSON stringify-able object to store.
 */

function bookalopeAddDocumentData(doc, key, value) {

    // Get private Bookalope data stored with the document. If none existed yet,
    // create an empty dictionary. Then add the given key:value to the dictionary,
    // or update the value if the key already existed.
    var data = bookalopeGetDocumentData(doc);
    if (data && data.bookalope) {
        var bookalopeData = data.bookalope;
    }
    else {
        var bookalopeData = {};
    }
    bookalopeData[key] = value;
    bookalopeSetDocumentData(doc, bookalopeData);
}


/**
 * Get information from the given document; if the document contains a Bookalope data
 * store then return that, too.
 *
 * @param {Document} doc - The InDesign document whose data store we want to return.
 * @returns {Object | null}
 */

function bookalopeGetDocumentData(doc) {

    // Safeguard, because this might be called with an invalid document.
    if (doc && doc.isValid) {

        // The document data.
        var data = {
            "doc": {
                "name": doc.name
            },
            "bookalope": null
        };

        // Return the private Bookalope data stored with the document as a dictionary,
        // or null if the document doesn't have any (i.e. is not a document generated
        // by Bookalope).
        var bookalopeData = doc.extractLabel("privateBookalopeDataStore");
        if (bookalopeData.length !== 0) {
            data.bookalope = JSON.parse(bookalopeData);
        }
        return data;
    }
    return null;
}


/**
 * Find the InDesign document based on the given name, and return the document's Bookalope
 * data store, or null if there was none.
 *
 * @param {string} docName - The name of the InDesign Document whose data store we're after.
 * @returns {string} A JSON stringified data store.
 */

function bookalopeGetDocumentDataFromName(docName) {

    // Find the document by its name, and then find and return the document's
    // private Bookalope data encoded to a JSON string.
    var doc = app.documents.itemByName(docName);
    return JSON.stringify(bookalopeGetDocumentData(doc));
}


/**
 * Find the currently active InDesign document, and return the document's Bookalope
 * data store, or null if there was none.
 *
 * @returns {string} A JSON stringified data store.
 */

function bookalopeGetDocumentDataFromActive() {

    // Find the currently active document, and then find and return the document's
    // private Bookalope data encoded to a JSON string.
    var doc = app.documents.length !== 0 ? app.activeDocument : undefined;
    return JSON.stringify(bookalopeGetDocumentData(doc));
}


/**
 * Creates a new InDesign document from an ICML file. The Book ID and Bookflow ID parameters
 * are stored alongside the new document in order to identify the Bookalope flow the document
 * belongs to. Note that the ID parameters are not being validated and are trusted values.
 *
 * See also:
 *  - https://www.adobe.com/content/dam/Adobe/en/devnet/indesign/cs55-docs/IDML/idml-specification.pdf
 *  - https://www.adobe.com/content/dam/Adobe/en/devnet/indesign/cs5_docs/idml/idml-cookbook.pdf
 *
 * @param {string} idmlFileName - The path of an IDML file which is to be loaded into InDesign.
 * @param {string} bookId - A valid Bookalope Book id.
 * @param {string} bookflowId - A valid Bookalope Bookflow id.
 * @param {boolean} betaHost - Booloan flag indicating whether the Book is on beta or production server.
 */

function bookalopeCreateDocument(idmlFileName, bookId, bookflowId, betaHost) {

    // Open the document in default mode, and display it.
    var idmlFile = new File(idmlFileName)
    var bookalopeDocument = app.open(idmlFile);

    // Bookalope keeps some private data alongside the document.
    bookalopeSetDocumentData(bookalopeDocument, {
        "book-id": bookId,
        "bookflow-id": bookflowId,
        "beta": betaHost
    });
}


/**
 * Create an RTF file from the document with the given name, and save that to the given path.
 *
 * @param {string} docName - Name of the document for which the RTF is created.
 * @param {string} rtfFileName - Path and file name to save the created RTF file.
 * @returns {boolean} True if the RTF was created successfully; false otherwise.
 */

function bookalopeDocumentByNameToRTF(docName, rtfFileName) {

    var doc = app.documents.itemByName(docName);
    return bookalopeDocumentToRTF(doc, rtfFileName);
}


/**
 * Create an RTF file from the currently active document, and save that to the given path.
 *
 * @param {string} rtfFileName - Path and file name to save the created RTF file.
 * @returns {boolean} True if the RTF was created successfully; false otherwise.
 */

function bookalopeActiveDocumentToRTF(rtfFileName) {

    var doc = app.documents.length !== 0 ? app.activeDocument : undefined;
    return bookalopeDocumentToRTF(doc, rtfFileName);
}


/**
 * Create an RTF file from the given document, and save that to the given path.
 *
 * @param {Document} doc - The InDesign document for which the RTF is created.
 * @param {string} rtfFileName - Path and file name to save the created RTF file.
 * @returns {boolean} True if the RTF was created successfully; false otherwise.
 */

function bookalopeDocumentToRTF(doc, rtfFileName) {

    if (doc && doc.isValid) {

        // TODO
        // return true;
    }
    return false;
}
