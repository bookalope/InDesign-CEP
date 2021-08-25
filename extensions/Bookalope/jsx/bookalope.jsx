
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

	//functions
	function uniqueName(base, type) {
		function strip_base (s) {
			return s.replace(/_\d+$/,'');
		}
		var n = 0;
		while (File (base+type).exists) {
			base = strip_base (base) + '_' + String (++n);
		}
		return base+type;
	}

	
	//adding includes method to the array object
	Array.prototype.includes = function(item) {
		var index = 0, length = this.length;
		for ( ; index < length; index++ ) {
			if ( this[index] === item ) {
				return true;
			}
		}
		return false;
	};
	
	//anchors image in the page
	function anchorImage(doc, textFrame, imageRect) {
		var myAnchoredFrame = createAnchor(doc, textFrame);
		var imBounds = imageRect.geometricBounds;
		var frBounds = textFrame.geometricBounds
		// Copy image into the anchored frame. Didn't find a better way  
		var imagePath = imageRect.images[0].itemLink.filePath;
		var image = imageRect.images[0];
		myAnchoredFrame.place(File(imagePath));
		myAnchoredFrame.geometricBounds = [imBounds[0] - frBounds[0], imBounds[1] - frBounds[1],
			imBounds[2] - frBounds[0], imBounds[3] - frBounds[1]
		];
		// Resize image  
		var newImBoundX = myAnchoredFrame.geometricBounds[1] - (imageRect.geometricBounds[1] - image.geometricBounds[1]);
		var newImBoundY = myAnchoredFrame.geometricBounds[0] - (imageRect.geometricBounds[0] - image.geometricBounds[0]);
		var newImBoundX1 = newImBoundX + (image.geometricBounds[3] - image.geometricBounds[1]);
		var newImBoundY1 = newImBoundY + (image.geometricBounds[2] - image.geometricBounds[0]);
		myAnchoredFrame.images[0].geometricBounds = [newImBoundY, newImBoundX, newImBoundY1, newImBoundX1];
		//Set textWrapPreferences of the images  
		myAnchoredFrame.textWrapPreferences.textWrapMode = imageRect.textWrapPreferences.textWrapMode;
		myAnchoredFrame.textWrapPreferences.textWrapOffset = imageRect.textWrapPreferences.textWrapOffset;
		return myAnchoredFrame;
	}

	//creates the anchor where it links the image
	function createAnchor(doc, textFrame) {
		var inPoint = textFrame.insertionPoints[0];
		var anchProps = doc.anchoredObjectDefaults.properties;
		var anchCont = anchProps.anchorContent;
		var myAO = inPoint.rectangles.add();
		// Make new object with correct default settings  
		// Make new object right kind of object  
		myAO.contentType = ContentType.graphicType;
		// Recompose parent story so geometricBounds make sense  
		inPoint.parentStory.recompose();
		//save users measurement preferences  
		userHoriz = doc.viewPreferences.horizontalMeasurementUnits;
		userVert = doc.viewPreferences.verticalMeasurementUnits;
		doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.points;
		doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.points;
		doc.viewPreferences.horizontalMeasurementUnits = userHoriz;
		doc.viewPreferences.verticalMeasurementUnits = userVert;
		myAO.applyObjectStyle(anchProps.anchoredObjectStyle);
		if (anchProps.anchorContent == ContentType.textType) {
			try { // might be null  
				myAO.parentStory.appliedParagraphStyle = anchProps.anchoredParagraphStyle;
			} catch (e) {}
		}
		myAO.anchoredObjectSettings.properties = doc.anchoredObjectSettings.properties;
		myAO.anchoredObjectSettings.anchoredPosition = AnchorPosition.anchored;
		myAO.anchoredObjectSettings.pinPosition = false;
		return myAO
	}
	
	function export_other (im, type, f) {
		try {
			var duped = im.duplicate();
			try {
				duped.images[0].clearTransformations();
				duped.images[0].fit (FitOptions.FRAME_TO_CONTENT);
			} catch (_) {
			}
			duped.exportFile (type, f, false);
			duped.remove();
		} catch (e) {
			problems += 1;
		}
	}
	
	debug = false;

	//here the script starts
    if (doc && doc.isValid) {
    
    	//checking if the document is saved
    	if(!doc.saved || doc.modified) {
			alert("Please save the file");
			return false;
		}
		
		//checking if all links exist
		for (i = 0; i < doc.links.length; i++) {
			var link = doc.links.item(i);
			if(link.status == LinkStatus.LINK_INACCESSIBLE || link.status == LinkStatus.LINK_MISSING || link.status == LinkStatus.LINK_OUT_OF_DATE) {
				alert("Please check links: some are not updated or missed");
				return false;
			}
		}

		//creating a temporary copy and opening it
        tmp_path = app.createTemporaryCopy(doc.fullName);
        //todo: switch to showingWindow=false
        showingWindow = false;
        if (debug) {
        	showingWindow = true;
        }
        doc = app.open(tmp_path, showingWindow=true);
        
        //unlocks all layers
        doc.layers.everyItem().locked = false;
        
        //unlock all elements
        doc.pageItems.everyItem().locked = false;
        
		//step 1.1: add text condition and style
		var stylePN = "bookalope-page-number";
		var pages = doc.pages;
		try {
			myCharacterStyle = doc.characterStyles.item(stylePN);
			myName = myCharacterStyle.name;

		} catch (myError) {
			myCharacterStyle = doc.characterStyles.add({ name: stylePN });
		}
		myCharacterStyle.pointSize = 0.1;
		
		//step 1.2: set page numbers – preferences
		var w = new Window('palette', 'Adding page number references...');
		w.pbar = w.add('progressbar', undefined, 0, pages.length);
		w.pbar.preferredSize.width = 300;
		w.show();
		for (var i = 0; i < pages.length; i++) {
			var myObjectList = new Array;
			var items = pages[i].textFrames;
			if (items.length !== 0) {
				for (var j = 0; j < items.length; j++) {
					if (items[j].parent.constructor.name === "Spread") {
						if (items[j].contents !== "" && (items[j].nextTextFrame || items[j].previousTextFrame)) {
							myObjectList.push(items[j]);
						}
					}
				}
				if (myObjectList.length !== 0) {
					myObjectList.sort(function (a,b) { return (a.geometricBounds[0] < b.geometricBounds[0]) || (a.geometricBounds[0] == b.geometricBounds[0] && a.geometricBounds[1] < b.geometricBounds[1]) ? -1 : 1; } );
					myTextFrame = myObjectList[0];
					var myInsertionPoint = myTextFrame.insertionPoints.item(0),
						myCharacterStyle = doc.characterStyles.item(stylePN);

					myInsertionPoint.contents = "" + pages[i].name;
					myInsertionPoint.applyCharacterStyle(myCharacterStyle, true);
				}
			}
			w.pbar.value = i;
		}
		w.hide();
		
		//step 2.0: deletes empty or invisible images
		var g = doc.allGraphics;
		to_delete = [];
		for (var i = 0; i < g.length; i++) {
			graphic = g[i];
			try {
				area = (graphic.visibleBounds[2] - graphic.visibleBounds[0]) * (graphic.visibleBounds[3] - graphic.visibleBounds[1])
				if (area == 0) {
					to_delete.push(graphic);
				}
			} catch(e) {
				to_delete.push(graphic);
			}
		}
		for (var t = 0; t < to_delete.length; t++) {
			to_delete[t].remove();
		}
		
		//step 2.1: dumpPastedImages – exports images that are embedded
		var g = doc.allGraphics;
		var outfolder = File(tmp_path).path;
		for (var i = 0; i < g.length; i++) {
			if (g[i].itemLink == null) {
				image_file = File (uniqueName(outfolder+'/img', '.png'));
				export_other (g[i], ExportFormat.PNG_FORMAT, image_file);
				g[i].parent.place (image_file);
			} else if (g[i].itemLink.status === LinkStatus.linkEmbedded) {
				app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
				g[i].itemLink.unembed(outfolder);
				app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALL;
			}
		}
		
		//step 3: anchorImages
		for (i = 0; i < doc.pages.length; i++) {
			var page = doc.pages.item(i);
			if (page.textFrames.length < 1) continue;
			var textFrame = page.textFrames.item(0);
			if (page.rectangles.length < 1) continue;
			// loop through all rectangles in the page  
			for (j = 0; j < page.rectangles.length; j++) {
				var imageRect = page.rectangles[j];
				if (imageRect.images.length < 1) continue;
				var myAnchoredFrame = anchorImage(doc, textFrame, imageRect);
				var pos = [imageRect.geometricBounds[1], imageRect.geometricBounds[0]];
				imageRect.remove();
				j--;
				textFrame.recompose();
				var k = 0;
				// Reposition the anchored image. This is done repeatedly because the first call not moves the frame to the correct position  
				do { myAnchoredFrame.move(pos); k++; } while (k != 5);
			}
		}
		
		//order stories
		var stories = [];
		var stories_id = [];

		//loop on all pages
		for(t = 0; t < doc.pages.length; t++){
			page = doc.pages.item(t);
	
			//if we have multiple frames in the same page, we order it
			var frames = [];
			for(u = 0; u < page.textFrames.length; u++){
				frames.push(page.textFrames.item(u))
			}
			//https://indesignsecrets.com/topic/thread-text-frames-by-name#post-124286
			frames.sort(function (a,b) { return (a.geometricBounds[0] < b.geometricBounds[0]) || (a.geometricBounds[0] == b.geometricBounds[0] && a.geometricBounds[1] < b.geometricBounds[1]) ? -1 : 1; } ); 
	
			//for each frame, if the story is not already in the order we add it
			for(u = 0; u < frames.length; u++){
				frame = frames[u];
				if(!stories_id.includes(frame.parentStory.id)) {
					stories.push(frame.parentStory);
					stories_id.push(frame.parentStory.id);
				}
			}
		}
		
		//we create a new story where we copy-paste all contents in the correct order
		var allContent = doc.textFrames.add();
		for(t = 0; t < stories.length; t++){
			story = stories[t];
			story.duplicate(LocationOptions.AT_END, allContent.parentStory);
			allContent.parentStory.insertionPoints[-1].contents = SpecialCharacters.FRAME_BREAK;
		}
		allContent.parentStory.exportFile(ExportFormat.RTF, rtfFileName);
		
		//close the document
		if(!debug) {
			doc.close(SaveOptions.NO);
		}
		
		return true;
    }
    return false;
}