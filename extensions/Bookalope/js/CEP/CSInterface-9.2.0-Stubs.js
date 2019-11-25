
/* CSInterface stubs.
 * See also: https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_9.x/CSInterface.js
 *
 * For the Bookalope extension to run, we need to stub out some of the CSInterface. However,
 * because the interface implements synchronous filesystem functionality (e.g. writing files)
 * and other Adobe application specific code that is not doable in browsers’ Javascript, the
 * stub functions sometimes log only and return faked-up result values. The Bookalope extension
 * is therefore testable and runable, but it’s not a fully functional duplicate.
 */


// Global error message string returned by CSInterface’s evalScript() function.
const EvalScript_ErrMessage = "EvalScript error.";


// The CSInterface() object describes the Adobe host application environment, and it provides
// a number of functions to the extension.
function CSInterface() {
  this.hostEnvironment = {
    "appName": undefined,
    "appVersion": undefined,
    "appLocale": undefined,
    "appUILocale": undefined,
    "appId": undefined,
    "isAppOnline": undefined,
    "appSkinInfo": {
      "baseFontFamily": undefined,
      "baseFontSize": undefined,
      "appBarBackgroundColor": undefined,
      "panelBackgroundColor": {
        "color": {
          "red": 68,
          "green": 68,
          "blue": 68,
          "alpha": 0
        }
      },
      "appBarBackgroundColorSRGB": undefined,
      "panelBackgroundColorSRGB": undefined,
      "systemHighlightColor": undefined
    }
  };
}


// Name of the “color changed” event triggered when the host application switches UI themes.
CSInterface.THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";


// No need to initialize the extension’s resource bundle here, because it doesn’t really
// use it at this point. Revisit later, if necessary.
CSInterface.prototype.initResourceBundle = function() {
  return undefined;
};


// Add event listener functions that are called from the host application for certain events.
// Without that host application, though, these events won’t trigger and therefore we don’t
// handle these callback functions any further at this point.
CSInterface.prototype.addEventListener = function(csEvent, callback) {
  if (csEvent === CSInterface.THEME_COLOR_CHANGED_EVENT) {
    // To do.
  } else if (csEvent === "documentAfterActivate") {
    // To do.
  } else if (csEvent === "documentBeforeClose") {
    // To do.
  }
};


// The evalScript() function thunks down from the extension to the Adobe host application and
// returns a result of the script that executed on the “other side”. Here too, without an
// actual host application, we simply fake a result value which gets this extension running in
// a browser context. The given callback function on “this side” receives a JSON result string.
// For more details on these scripts, see jsx/bookalope.jsx.
CSInterface.prototype.evalScript = function(script, callback) {
  new Promise(function(resolve, reject) {

    // Return some information about the host application’s configuration.
    if (script === "getConfiguration();") {
      let config = {
        "app": {
          "version": "14.0.0.0",
          "user": "User Name",
          "win": false
        },
        "fs": {
          "data": "/path/to/home/Desktop",
          "desktop": "/path/to/home/Desktop",
          "tmp": "/tmp",
          "separator": "/"
        }
      };
      resolve(JSON.stringify(config));
    }

    // Create a new document inside of the host application (i.e. Adobe InDesign).
    else if (script.startsWith("bookalopeCreateDocument(")) {
      resolve(undefined);
    }

    // A document in the host application can have Bookalope extension-specific data attached
    // to it. This one returns such data from the currently active document; having no host
    // application, though, there is no active document and therefore no data.
    else if (script === "bookalopeGetDocumentDataFromActive();") {
      let data = {
        "book-id": undefined,
        "bookflow-id": undefined,
        "beta": true
      };
      resolve(JSON.stringify(null));
    }

    // Needs to be implemented!
    else {
      // To do.
    }
  }).then(callback);
};


// And then there is the CEP context attached to the root of the DOM. It provides helper functions
// that are not always available in the context of a normal web browser, so here too we simply stub
// them out to get the extension running.
window.cep = {
  "fs": {
    "deleteFile": function(filename) {
      console.log("STUB: deleting file: " + filename);
      return {"err": undefined};
    },
    "writeFile": function(filename, data, encoding) {
      console.log("STUB: writing to file: " + filename);
      return {"err": undefined};
    },
    "readFile": function(filename, encoding) {
      console.log("STUB: reading from file: " + filename);
      return {"err": undefined};
    },
    "showSaveDialogEx": function(title, formats, filename) {
      console.log("STUB: open file dialog using default name: " + filename);
      return {"err": undefined, "data": filename};
    }
  },
  "encoding": {
    "Base64": "Base64"
  },
  "util": {
    "openURLInDefaultBrowser": function(url) {
      console.log("STUB: open browser window with url: " + url);
      window.open(url, "_blank");
      return {"err": undefined};
    }
  }
};
