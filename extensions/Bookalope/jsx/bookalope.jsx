
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
            win: Folder.fs === "Windows"
        },
        fs: {
            data: Folder.userData.fsName,
            desktop: Folder.desktop.fsName,
            tmp: Folder.temp.fsName,
            separator: Folder.fs === "Windows" ? "\\" : "/"
        }
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
    var idmlFile = new File(idmlFileName);
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
 * @returns {string,bool} False if an error occurred, otherwise the complete path to the RTF file.
 */

function bookalopeDocumentByNameToRTF(docName) {

    var doc = app.documents.itemByName(docName);
    try {
        return bookalopeDocumentToRTF(doc);
    } catch (exc) {
        alert("Failed to export document: " + exc);
        return JSON.stringify(false);
    }
}


/**
 * Create an RTF file from the currently active document, and save that to the given path.
 *
 * @returns {string,bool} False if an error occurred, otherwise the complete path to the RTF file.
 */

function bookalopeActiveDocumentToRTF() {

    var doc = app.documents.length !== 0 ? app.activeDocument : undefined;
    try {
        return bookalopeDocumentToRTF(doc);
    } catch (exc) {
        alert("Failed to export document: " + exc);
        return JSON.stringify(false);
    }
}


/**
 * Create an RTF file from the given document, and save that to the given path.
 *
 * @param {Document} doc - The InDesign document for which the RTF is created.
 * @returns {string,bool} False if an error occurred, otherwise the complete path to the RTF file.
 */

function bookalopeDocumentToRTF(doc) {

    // Check that we work with a valid document.
    if (!doc || !doc.isValid) {
        alert("Unable to export an invalid document to Bookalope");
        return JSON.stringify(false);
    }

    // When we export the RTF we want to make sure that the original active
    // document and its resources have also been saved.
    if (!doc.saved || doc.modified) {
        alert("Please save this document before exporting it to Bookalope");
        return JSON.stringify(false);
    }

    // Make sure that all links in the document are valid.
    for (var i = 0; i < doc.links.length; i++) {
        var link = doc.links.item(i);
        if (link.status === LinkStatus.LINK_INACCESSIBLE || link.status === LinkStatus.LINK_MISSING || link.status === LinkStatus.LINK_OUT_OF_DATE) {
            alert("Please check the links in this document: some are not up-to-date or are missing");
            return JSON.stringify(false);
        }
    }

    // A polyfill of Array.prototype.includes, although this may not be
    // necessary at some point for new versions of InDesign anymore.
    if (!Array.prototype.includes) {
        Array.prototype.includes = function(item) {
            for (var i = 0; i < this.length; i++) {
                if (this[i] === item) {
                    return true;
                }
            }
            return false;
        };
    }

    /**
     * Generate a unique filename.
     *
     * @param {string} base - The path and base name of the filename.
     * @param {string} ext - The filename extension, including dot.
     * @return {string} The unique path and filename.
     */
    function createUniqueName(base, ext) {
        for (var i = 0; new File(base + ext).exists; i++) {
            base = base.replace(/_\d+$/, "") + "_" + String(i);
        }
        return base + ext;
    }

    /**
     * Given a text frame and an image, duplicate image near to the text
     * frame for export.
     *
     * @param {TextFram} textFrame - Target text frame where to anchor the image.
     * @param {Rectangle} imageRect - The image that's duplicated and anchored.
     * @return {Rectangle} The anchored new image.
     */
    function anchorImage(textFrame, imageRect) {

        // Create an anchor in the given text frame for the image.
        var insertionPoint = textFrame.insertionPoints[0];
        var anchor = insertionPoint.rectangles.add();
        anchor.contentType = ContentType.graphicType;

        // Recompose the parent story so that the geometricBounds make sense.
        insertionPoint.parentStory.recompose();

        // Save the user's measurement preferences, and then switch to points unit.
        var userHoriz = tmpDoc.viewPreferences.horizontalMeasurementUnits;
        var userVert = tmpDoc.viewPreferences.verticalMeasurementUnits;
        tmpDoc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.points;
        tmpDoc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.points;

        // Configure the custom anchor.
        var anchorProps = tmpDoc.anchoredObjectDefaults.properties;
        anchor.applyObjectStyle(anchorProps.anchoredObjectStyle);
        if (anchorProps.anchorContent == ContentType.textType) {
            try {
                anchor.parentStory.appliedParagraphStyle = anchorProps.anchoredParagraphStyle;
            } catch (_) {
                // Might be null, and we do nothing in that case.
            }
        }
        anchor.anchoredObjectSettings.properties = doc.anchoredObjectSettings.properties;
        anchor.anchoredObjectSettings.anchoredPosition = AnchorPosition.anchored;
        anchor.anchoredObjectSettings.pinPosition = false;

        // Get the geometric boundaries for both objects.
        var frameBounds = textFrame.geometricBounds;
        var imageBounds = imageRect.geometricBounds;

        // Copy image into the anchored frame and resize its bounds.
        var image = imageRect.images[0];
        var imagePath = image.itemLink.filePath;
        anchor.place(new File(imagePath));
        anchor.geometricBounds = [
            imageBounds[0] - frameBounds[0],
            imageBounds[1] - frameBounds[1],
            imageBounds[2] - frameBounds[0],
            imageBounds[3] - frameBounds[1]
        ];

        // Then resize the image itself.
        var newImageBoundY = anchor.geometricBounds[0] - (imageBounds[0] - imageBounds[0]);
        var newImageBoundX = anchor.geometricBounds[1] - (imageBounds[1] - imageBounds[1]);
        anchor.images[0].geometricBounds = [
            newImageBoundY,
            newImageBoundX,
            newImageBoundY + (image.geometricBounds[2] - image.geometricBounds[0]),
            newImageBoundX + (image.geometricBounds[3] - image.geometricBounds[1])
        ];

        // Adjust the textWrapPreferences for the anchored image.
        anchor.textWrapPreferences.textWrapMode = imageRect.textWrapPreferences.textWrapMode;
        anchor.textWrapPreferences.textWrapOffset = imageRect.textWrapPreferences.textWrapOffset;
    }

    /**
     * Write the given Image object to disk using the given path and file name.
     *
     * @param {Graphic} graphic - The Graphic object to export.
     * @param {File} file - The File object represents a local host file.
     */
    function exportPNG(graphic, file) {
        try {
            var other = graphic.duplicate();
            try {
                // FIXME Where's images documented?
                // https://www.indesignjs.de/extendscriptAPI/indesign-latest/#Graphic.html
                other.images[0].clearTransformations();
                other.images[0].fit(FitOptions.FRAME_TO_CONTENT);
            } catch (_) {
                // Ignore any problem and try to export the image anyway.
            }
            other.exportFile(ExportFormat.PNG_FORMAT, file);
            other.remove();
        } catch (_) {
            // Notify caller/user that exporting the image failed:
            // https://github.com/bookalope/InDesign-CEP/pull/13#issuecomment-938668459
        }
    }

    /**
     * Compare the locations of two text frames based on their respective geometric
     * boundaries (which have the format [y1, x1, y2, x2]). Returns -1 if frameA
     * is above or left of frameB (i.e. is "smaller"); returns 1 otherwise.
     *
     * @param {TextFrame} frameA - A TextFrame object reference.
     * @param {TextFrame} frameB - A TextFrame object reference.
     * @return {Number} -1 if frameA is smaller than frameB, 1 otherwise.
     */
    function cmpFrames(frameA, frameB) {
        if (frameA.geometricBounds[0] < frameB.geometricBounds[0]) {
            return -1;
        }
        if (frameA.geometricBounds[0] == frameB.geometricBounds[0]) {
            return (frameA.geometricBounds[1] < frameB.geometricBounds[1]) ? -1 : 1;
        }
        return 1;
    }

    // Create a temporary copy of the document that we want to export. It looks like
    //
    //     var tmpFile = new File(app.createTemporaryCopy(doc.fullName));
    //
    // doesn't work on Windows because `createTemporaryCopy()` doesn't actually create
    // a temporary copy. so we take the manual approach here. See also this Slack
    // conversation: https://adobedevs.slack.com/archives/C1FKLQ63F/p1635906342026700
    var docFile = doc.fullName;
    var tmpPath = Folder.temp;
    var tmpFileName = tmpPath + "/" + docFile.name;
    if (!docFile.copy(tmpFileName)) {
        alert("Unable to create a temporary copy of the document");
        return JSON.stringify(false);
    }
    var tmpFile = new File(tmpFileName);
    var tmpDoc = app.open(tmpFile, false);

    // Open a progress bar window, where max progress is defined by the 8 steps
    // (i.e. progress 0 through 7) for this RTF conversion. Then, times 100 because
    // we'll track progress per step in percent, too. Note that `pbarInc` can become
    // `Infinity` if the number of processed items (e.g. pages.length) is zero. In
    // that case it won't matter because `pbarInc` isn't used.
    var progressWin = new Window("palette", "Preparing document for Bookalope...");
    progressWin.pbar = progressWin.add("progressbar", undefined, 0, 7 * 100);
    progressWin.pbar.preferredSize.width = 300;
    progressWin.pbar.value = 0;
    progressWin.show();
    var pbarVal, pbarInc;  // To update the progress bar during each step.

    // Step 1: unlock all layers and elements in the document.
    tmpDoc.layers.everyItem().locked = false;
    tmpDoc.pageItems.everyItem().locked = false;
    progressWin.pbar.value = pbarVal = 100;

    // Step 2: add a character style for page numbers that we'll inject
    // into the text further down. Bookalope will know what to do with
    // that extra goodness.
    var pgnrCharacterStyleName = "bookalope-page-number";
    var pgnrCharacterStyle = tmpDoc.characterStyles.itemByName(pgnrCharacterStyleName);
    if (!pgnrCharacterStyle.isValid) {
        pgnrCharacterStyle = tmpDoc.characterStyles.add({
            name: pgnrCharacterStyleName,
            pointSize: 0.1
        });
    }
    progressWin.pbar.value = pbarVal = 200;

    // Step 3: insert into the text and where the text flow breaks onto the
    // next page and using our special character style the page name of the
    // current page.
    pbarInc = (1 / tmpDoc.pages.length) * 100;
    for (var i = 0; i < tmpDoc.pages.length; i++) {
        var pageTextFrames = [];
        var page = tmpDoc.pages[i];
        var textFrames = page.textFrames;
        for (var j = 0; j < textFrames.length; j++) {
            var textFrame = textFrames[j];
            if (textFrame.parent.constructor.name === "Spread") {
                if (textFrame.contents !== "" && (textFrame.nextTextFrame || textFrame.previousTextFrame)) {
                    pageTextFrames.push(textFrame);
                }
            }
        }
        if (pageTextFrames.length !== 0) {
            pageTextFrames.sort(cmpFrames);
            var textFrame = pageTextFrames[0];
            var insertionPoint = textFrame.insertionPoints.item(0);
            insertionPoint.contents = "" + page.name;
            insertionPoint.applyCharacterStyle(pgnrCharacterStyle, true);
        }
        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    progressWin.pbar.value = pbarVal = 300;

    // Step 4: delete empty graphics, and then export the embedded images.
    var docGraphics = tmpDoc.allGraphics;
    var emptyGraphics = [];
    pbarInc = (1 / docGraphics.length) * 100 * (1/3);
    for (var i = 0; i < docGraphics.length; i++) {
        var graphic = docGraphics[i];
        try {
            var area = (graphic.visibleBounds[2] - graphic.visibleBounds[0]) * (graphic.visibleBounds[3] - graphic.visibleBounds[1]);
            if (area === 0) {
                emptyGraphics.push(graphic);
            }
        } catch(_) {
            emptyGraphics.push(graphic);
        }
        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    pbarInc = (1 / emptyGraphics.length) * 100 * (1/3);
    for (var i = 0; i < emptyGraphics.length; i++) {
        emptyGraphics[i].remove();

        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    docGraphics = tmpDoc.allGraphics;
    pbarInc = (1 / docGraphics.length) * 100 * (1/3);
    for (var i = 0; i < docGraphics.length; i++) {
        var graphic = docGraphics[i];
        if (graphic.itemLink == null) {
            var tmpImgFile = new File(createUniqueName(tmpPath + "/img", ".png"));
            exportPNG(graphic, tmpImgFile);
            graphic.parent.place(tmpImgFile);
        } else if (graphic.itemLink.status === LinkStatus.linkEmbedded) {
            app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
            graphic.itemLink.unembed(tmpPath);
            app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALL;
        } else {
            // Ignore other link statuses:
            // https://github.com/bookalope/InDesign-CEP/pull/13#issuecomment-938669971
        }
        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    progressWin.pbar.value = pbarVal = 400;

    // Step 5: anchor images on document pages.
    pbarInc = (1 / tmpDoc.pages.length) * 100;
    for (var i = 0; i < tmpDoc.pages.length; i++) {
        var page = tmpDoc.pages.item(i);
        if (page.textFrames.length >= 1) {
            // Each image must be anchored in order to be exported correctly to RTF,
            // so we anchor them to the first text box on the page. We can tell the
            // user that if they have unexpected results (images anchored in incorrect
            // places) they can anchor images manually before running the script.
            var textFrame = page.textFrames.item(0);
            if (page.rectangles.length >= 1) {
                for (var j = 0; j < page.rectangles.length; j++) {
                    var imageRect = page.rectangles[j];
                    if (imageRect.images.length >= 1) {
                        anchorImage(textFrame, imageRect);
                    }
                }
            }
        }
        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    progressWin.pbar.value = pbarVal = 500;

    // Step 6: order stories so we can export them in sequence. So we loop over all pages,
    // and over all frames on a single page, and order the frames.
    var stories = [];
    var storiesId = [];
    pbarInc = (1 / tmpDoc.pages.length) * 100;
    for (var i = 0; i < tmpDoc.pages.length; i++) {
        var page = tmpDoc.pages.item(i);
        var frames = [];
        for (var j = 0; j < page.textFrames.length; j++) {
            frames.push(page.textFrames.item(j));
        }
        frames.sort(cmpFrames);

        // For each frame, if its story is not already in the ordered list, we add it.
        for (var j = 0; j < frames.length; j++) {
            var frame = frames[j];
            var story = frame.parentStory;
            var storyId = story.id;
            if (!storiesId.includes(storyId)) {
                stories.push(story);
                storiesId.push(storyId);
            }
        }
        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    progressWin.pbar.value = pbarVal = 600;

    // Step 7: create a new story where we copy-paste all contents in the correct order.
    var newContent = tmpDoc.textFrames.add();
    pbarInc = (1 / stories.length) * 100;
    for (var i = 0; i < stories.length; i++) {
        var story = stories[i];
        story.duplicate(LocationOptions.AT_END, newContent.parentStory);
        newContent.parentStory.insertionPoints[-1].contents = SpecialCharacters.FRAME_BREAK;

        pbarVal += pbarInc;
        progressWin.pbar.value = Math.round(pbarVal);
    }
    var rtfFile = new File(createUniqueName(tmpPath + "/bookalope-document", ".rtf"));
    newContent.parentStory.exportFile(ExportFormat.RTF, rtfFile);
    progressWin.pbar.value = pbarVal = 700;

    // Step 8: close the active & temporary document and the progress window, and return.
    tmpDoc.close(SaveOptions.NO);
    progressWin.hide();  // Dispose of the window?
    return JSON.stringify(rtfFile.fsName);
}
