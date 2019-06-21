
/*
 * By default, ExtendScript has no JSON support and so we add it here.
 * See also:
 *  - https://forums.adobe.com/message/9015663#9015663
 *  - https://github.com/douglascrockford/JSON-js
 */

if(typeof JSON!=='object'){JSON={};}(function(){'use strict';function f(n){return n<10?'0'+n:n;}function this_value(){return this.valueOf();}if(typeof Date.prototype.toJSON!=='function'){Date.prototype.toJSON=function(){return isFinite(this.valueOf())?this.getUTCFullYear()+'-'+f(this.getUTCMonth()+1)+'-'+f(this.getUTCDate())+'T'+f(this.getUTCHours())+':'+f(this.getUTCMinutes())+':'+f(this.getUTCSeconds())+'Z':null;};Boolean.prototype.toJSON=this_value;Number.prototype.toJSON=this_value;String.prototype.toJSON=this_value;}var cx,escapable,gap,indent,meta,rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==='string'?c:'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);})+'"':'"'+string+'"';}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}if(typeof rep==='function'){value=rep.call(holder,key,value);}switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==='[object Array]'){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}v=partial.length===0?'[]':gap?'[\n'+gap+partial.join(',\n'+gap)+'\n'+mind+']':'['+partial.join(',')+']';gap=mind;return v;}if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){if(typeof rep[i]==='string'){k=rep[i];v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}if(typeof JSON.stringify!=='function'){escapable=/[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'};JSON.stringify=function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}return str('',{'':value});};}if(typeof JSON.parse!=='function'){cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}return reviver.call(holder,key,value);}text=String(text);cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);});}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}throw new SyntaxError('JSON.parse');};}}());


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
        },
        tmp: Folder.temp.toString(),
    };
    return JSON.stringify(config);
}


/**
 * When we open a new InDesign document, apply theses styles to the document. Currently
 * this is all hardwired in for a single and overly simplistic design.
 *
 * See also: http://www.indesignjs.de/extendscriptAPI/indesign-latest/#Document.html
 *
 * @param {Document} doc - The InDesign document that needs styling.
 */

function setDefaultStyle(doc) {

    // Set the measurement units and ruler origin for the document to points.
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.points;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.points;
    doc.viewPreferences.rulerOrigin = RulerOrigin.pageOrigin;

    /**
     * Helper function: get (if exists) or create (if doesn't exist) a named paragraph
     * style for this document. This function is currently unused.
     *
     * See also: http://www.indesignjs.de/extendscriptAPI/indesign-latest/#ParagraphStyle.html
     *
     * @param {string} name - The name of the paragraph style we're looking for.
     * @returns {ParagraphStyle}
     */

    function getParagraphStyle(name) {
        var paragraphStyle = doc.paragraphStyles.item(name);
        if (!paragraphStyle.isValid) {
            paragraphStyle = doc.paragraphStyles.add({name: name});
        }
        return paragraphStyle;
    }


    // Get a reference to the master spread.
    var masterSpread = doc.masterSpreads.item(0);

    // Get the left (verso) page of the document and set it up...
    var masterLeftPage = masterSpread.pages.item(0);

    // ...page margins, ...
    masterLeftPage.marginPreferences.properties = {
        left: 84,
        top: 70,
        right: 70,
        bottom: 78,
    };

    // ...footer with an automatically incrementing page number, ...
    var footer = masterLeftPage.textFrames.add();
    footer.textFramePreferences.firstBaselineOffset = FirstBaseline.leadingOffset;
    footer.properties = {
        // label: "",
        geometricBounds: [728, 70, 742, 528],
        contents: SpecialCharacters.autoPageNumber,
    };
    footer.parentStory.characters.item(0).properties = {
        pointSize: 11,
        leading: 14,
        justification: Justification.leftAlign,
    };

    // ...main text frame to flow the page content.
    var textFrame = masterLeftPage.textFrames.add();
    textFrame.textFramePreferences.firstBaselineOffset = FirstBaseline.leadingOffset;
    //textFrame.textFramePreferences.textColumnCount =
    //textFrame.textFramePreferences.textColumnGutter =
    textFrame.properties = {
        label: "BodyTextFrame",
        geometricBounds: [70, 70, 714, 528],
    };

    // Get the right (recto) page of the document and set it up...
    var masterRightPage = masterSpread.pages.item(1);

    // ...page margins, ...
    masterRightPage.marginPreferences.properties = {
        left: 84,
        top: 70,
        right: 70,
        bottom: 78,
    };

    // ...footer with an automatically incrementing page number, ...
    footer = masterRightPage.textFrames.add();
    footer.textFramePreferences.firstBaselineOffset = FirstBaseline.leadingOffset;
    footer.properties = {
        // label: "",
        geometricBounds: [728, 84, 742, 542],
        contents: SpecialCharacters.autoPageNumber,
    };
    footer.parentStory.characters.item(0).properties = {
        pointSize: 11,
        leading: 14,
        justification: Justification.rightAlign,
    };

    // ...main text frame to flow the page content.
    textFrame = masterRightPage.textFrames.add();
    textFrame.textFramePreferences.firstBaselineOffset = FirstBaseline.leadingOffset;
    //textFrame.textFramePreferences.textColumnCount =
    //textFrame.textFramePreferences.textColumnGutter =
    textFrame.properties = {
        label: "BodyTextFrame",
        geometricBounds: [70, 84, 714, 542],
    };

    // Link the main text frames on both pages together.
    masterLeftPage.textFrames.item(0).nextTextFrame = masterRightPage.textFrames.item(0);

    // Set a baseline grid for the document.
    doc.gridPreferences.properties = {
        baselineDivision: 14,
        baselineStart: 70,
        baselineGridShown: true,
    };
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
    var data = bookalopeGetDocumentData(doc) || {};
    data[key] = value;

    // Add the data back to the document.
    doc.insertLabel("privateBookalopeDataStore", JSON.stringify(data));
}


/**
 * Get the given document's Bookalope data store, or null if there was none.
 *
 * @param {Document} doc - The InDesign document whose data store we want to return.
 * @returns {Object | null}
 */

function bookalopeGetDocumentData(doc) {

    // Safeguard, because this might be called with an invalid document.
    if (doc && doc.isValid) {

        // Return the private Bookalope data stored with the document as a dictionary,
        // or null if the document doesn't have any (i.e. is not a document generated
        // by Bookalope).
        var jsonData = doc.extractLabel("privateBookalopeDataStore");
        if (0 !== jsonData.length) {
            return JSON.parse(jsonData);
        }
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
 * @param {string} icmlFileName - The path of an ICML file which is to be placed in the
 *                                newly created InDesign document.
 * @param {string} bookId - A valid Bookalope Book id.
 * @param {string} bookflowId - A valid Bookalope Bookflow id.
 * @param {boolean} betaHost - Booloan flag indicating whether the Book is on beta or production server.
 */

function bookalopeCreateDocument(icmlFileName, bookId, bookflowId, betaHost) {

    // Create and add a new document.
    var bookalopeDocument = app.documents.add();

    // Save the current view preferences of the document. (Does this create a deep copy
    // of the preferences or just keep a reference, in which case the next lines might
    // still trash the properties!)
    var currentViewPrefs = bookalopeDocument.viewPreferences.properties;

    // Set the styling of the master spread of this document.
    setDefaultStyle(bookalopeDocument);

    // Restore the saved view preferences.
    bookalopeDocument.viewPreferences.properties = currentViewPrefs;

    // New page and text frame in the document based on the master spread.
    var masterSpread = bookalopeDocument.masterSpreads.item(0);
    var textFrame = masterSpread.pages.item(1).textFrames.item(0).override(bookalopeDocument.pages.item(0));

    // The ICML file contains only structure, the structural elements have been styled
    // above. Now place the entire structured document onto the pages.
    var icmlFile = new File(icmlFileName);
    textFrame.place(icmlFile);
    bookalopeDocument.links.itemByName(icmlFile.name).unlink();

    // Bookalope keeps some private data alongside the document.
    bookalopeAddDocumentData(bookalopeDocument, "book-id", bookId);
    bookalopeAddDocumentData(bookalopeDocument, "bookflow-id", bookflowId);
    bookalopeAddDocumentData(bookalopeDocument, "beta", betaHost);
}
