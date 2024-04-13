/*jslint browser: true, devel: true */
/*global window, document, navigator, atob */
/*global Promise, Blob, FileReader, CustomEvent, localStorage, CSInterface */
/*global BookalopeClient, BookalopeError, Book, Bookflow */
/*global refreshSpectrumDropdowns */


/**
 * Helper function to check for a number of features that we rely on. Instead of
 * checking for Chromium or Javascript version, feature detection is the recommended
 * approach instead.
 *
 * See also: https://stackoverflow.com/questions/7340726/detect-version-of-javascript#7340885
 *
 * @returns {Object} An empty array object if all features are supported, or an array of
 *                   strings listing all missing features.
 */

function detectFeatures() {
    var missing = [];

    // Check that we have native Promises.
    if (typeof Promise === "function" && Promise.toString().indexOf("[native code]") !== -1) {
        // We've got native Promises.
    } else {
        missing.push("Promise");
    }
    // Check that we have native Blobs.
    if (typeof Blob === "function" && Blob.toString().indexOf("[native code]") !== -1) {
        // We've got native Blob.
    } else {
        missing.push("Blob");
    }
    // Check that we have a native FileReader.
    if (typeof FileReader === "function" && FileReader.toString().indexOf("[native code]") !== -1) {
        // We've got native FileReader.
    } else {
        missing.push("FileReader");
    }
    // Check that we have the Array.from() method. Because the extension supports InDesign
    // versions 11 (CEP6) and 12 (CEP7) it therefore must run on Chromium 41.0.2272.104 which
    // does not have a native Array.from() method: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
    if (typeof Array.from === "function" && Array.from.toString().indexOf("[native code]") !== -1) {
        // We've got a native Array.from() method.
    }
    else {
        // No support for a native Array.from() method, so we add a simple implementation shim.
        Array.from = function (thing) {
            var array = []
            for (var count = 0; count < thing.length; count++) {
                array.push(thing[count]);
            }
            return array;
        };
    }

    return missing;
}


/**
 * Retrieve the user's Bookalope API tokens and beta host flag that's stored by Chromium,
 * or return default values if they weren't found.
 *
 * See also: https://developer.mozilla.org/en/docs/Web/API/Window/localStorage
 *
 * @returns {object} The user's Bookalope API tokens and whether to access Bookalope's beta host.
 */

function getBookalopeAPITokens() {
    var tokenProd = "";
    var tokenBeta = "";
    var useBetaHost = false;
    if (typeof localStorage === "object") {
        tokenProd = localStorage.getItem("idsn_extension_bookalope_api_token");
        tokenBeta = localStorage.getItem("idsn_extension_bookalope_beta_api_token");
        useBetaHost = localStorage.getItem("idsn_extension_bookalope_beta_host") === "true";
    }
    return {
        tokenProd: isToken(tokenProd) ? tokenProd : "",
        tokenBeta: isToken(tokenBeta) ? tokenBeta : "",
        useBetaHost: useBetaHost
    };
}


/**
 * Store the given Bookalope API tokens and beta host flag for later use. Makes it easier
 * for the user so she doesn't have to keep entering the token between sessions.
 *
 * See also: https://developer.mozilla.org/en/docs/Web/API/Window/localStorage
 *
 * @param {string} tokenProd - A valid Bookalope token for the production server.
 * @param {string} tokenBeta - A valid Bookalope token for the beta server.
 * @param {boolean} useBetaHost - Flag indicating whether to use the Beta or Production host.
 */

function setBookalopeAPITokens(tokenProd, tokenBeta, useBetaHost) {
    if (typeof localStorage === "object") {
        localStorage.setItem("idsn_extension_bookalope_api_token", isToken(tokenProd) ? tokenProd : "");
        localStorage.setItem("idsn_extension_bookalope_beta_api_token", isToken(tokenBeta) ? tokenBeta : "");
        localStorage.setItem("idsn_extension_bookalope_beta_host", useBetaHost);
    }
}


/**
 * There are two main interfaces: an Upload panel and an Update panel. The Upload panel
 * allows the user to upload and convert a manuscript, and the Update panel where the user
 * may open the Bookalope flow in a web browser or download other file formats of the
 * converted manuscript.
 *
 * This function shows the Upload panel and hides the Update panel. It also clears all
 * fields of the Upload panel.
 */

function showUpload() {

    // Reset configuration fields.
    document.getElementById("input-file").value = "";
    document.getElementById("input-file").dispatchEvent(new Event("change"));
    document.getElementById("input-book-name").value = "";
    document.getElementById("input-book-author").value = "";
    document.getElementById("input-book-language").value = "";
    document.getElementById("input-book-copyright").value = "";
    document.getElementById("input-book-pubdate").valueAsDate = new Date();
    document.getElementById("input-book-isbn").value = "";
    document.getElementById("input-book-publisher").value = "";
    document.getElementById("input-book-credit").checked = false;
    document.getElementById("input-book-autoclean").checked = true;
    document.getElementById("input-book-highlight-issues").checked = false;
    document.getElementById("input-book-skip-structure").checked = false;

    document.getElementById("bookalope-upload").classList.remove("hidden");
    document.getElementById("bookalope-update").classList.add("hidden");
}


/**
 * There are two main interfaces: an Upload panel and an Update panel. The Upload panel
 * allows the user to upload and convert a manuscript, and the Update panel where the user
 * may open the Bookalope flow in a web browser or download other file formats of the
 * converted manuscript.
 *
 * This function shows the Update panel and hides the Upload panel.
 */

function showUpdate() {
    document.getElementById("bookalope-upload").classList.add("hidden");
    document.getElementById("bookalope-update").classList.remove("hidden");
}


/**
 * Show the Spinner overlay that blocks a panel.
 */

function showSpinner() {
    document.getElementById("spinner").classList.remove("hidden");
}


/**
 * Hide the Spinner overlay to enable input for a panel.
 */

function hideSpinner() {
    document.getElementById("spinner").classList.add("hidden");
}


/**
 * There is a status message box at the bottom of both panels. This function renders
 * a given message of the given class into that message box.
 *
 * @param {string} message - The message to be displayed.
 * @param {string} msgClass - One of two CSS class names, "spectrum-StatusLight--celery" or "spectrum-StatusLight--negative".
 */

function showMessage(message, msgClass) {
    var messageBox = document.getElementById("status-message-box");
    messageBox.classList.remove("spectrum-StatusLight--celery", "spectrum-StatusLight--negative");
    messageBox.classList.add(msgClass);
    messageBox.innerHTML = message;
}


/**
 * Highlights an input element which triggered an error, and displays the error message
 * in the message box.
 *
 * @param {Element} element - A DOM element which triggered an error.
 * @param {string} text - The error message.
 */

function showElementError(element, text) {
    element.classList.add("is-invalid");

    var field = element.parentNode;
    if (element.classList.contains("spectrum-Picker-select") === true || element.classList.contains("spectrum-Picker-input") === true) {
        field = element.closest(".spectrum-Picker");
    }
    else if (element.classList.contains("spectrum-Checkbox-input") === true) {
        field = element.closest(".spectrum-Checkbox");
    }
    else if (element.classList.contains("spectrum-Textfield-input") === true) {
        // Already the correct parent element.
    }
    if (field !== null) {
        field.classList.add("is-invalid");
    }

    showMessage("Error: " + text, "spectrum-StatusLight--negative");
}


/**
 * Displays an error message caused by InDesign itself.
 *
 * @param {string} text - The error message.
 */

function showClientError(text) {
    showMessage("InDesign client error: " + text, "spectrum-StatusLight--negative");
}


/**
 * Displays an error message reported by the Bookalope server.
 *
 * @param {string} text - The error message.
 */

function showServerError(text) {
    showMessage("Bookalope server error: " + text, "spectrum-StatusLight--negative");
}


/**
 * Displays a status message.
 *
 * @param {string} text - The status message.
 */

function showStatus(text) {
    showMessage("Status: " + text, "spectrum-StatusLight--celery");
}


/**
 * Displays a generic Ok status message.
 */

function showStatusOk() {
    showStatus("Ok (v1.4.1)");
}


/**
 * Removes all (if any) element error highlights from the panel, and then shows
 * the generic Ok status message.
 */

function clearErrors() {
    Array.from(document.getElementsByClassName("is-invalid")).forEach(function (element) {
        element.classList.remove("is-invalid");
    });
    showStatusOk();
}


/**
 * Generate and return a UUID of Variant 1, Version 4, a random UUID.
 * @returns {string} The random UUID.
 */

function makeUUID4() {
    // https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid#2117523
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c == "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


/**
 * Given a Bookalope Bookflow object, converts the book into the given file format
 * and saves the converted file. Returns a Promise that is fulfilled with the document's
 * filename or rejected with an error string.
 *
 * @param {Bookflow} bookflow - A valid Bookflow object referencing a server-side document conversion.
 * @param {string} format - Convert the given document to this format.
 * @param {string} style - The styling for the converted InDesign story.
 * @param {string} filename - The file name to save the converted file.
 * @returns {Promise}
 */

function saveBookflowFile(bookflow, format, style, filename) {

    // Create and return a new Promise.
    return new Promise(function (resolve, reject) {

        // Call the Bookflow's convert function, which itself returns a Promise. The returned
        // Promise is fulfilled with the Booklow ready for waiting, or rejected with a BookalopeError.
        bookflow.convert(format, style)
        .then(function (bookflow) {

            // Conversion is triggered on the server, now check periodically the status of the
            // conversion until it has succeeded or failed.
            var intervalID = window.setInterval(function (bookflow) {
                bookflow.convert_status(format)
                .then(function (status_) {

                    // Conversion succeeded, now download and save the converted file.
                    if (status_ === "available") {
                        window.clearInterval(intervalID);
                        bookflow.convert_download(format)
                        .then(function (blob) {

                            // Read the Blob's data as a data URL: a MIME header with Base64 encoded content.
                            var reader = new FileReader();
                            reader.addEventListener("loadend", function () {

                                // If an error occurred we reject the Promise we made, else we carry on saving the file..
                                if (reader.error) {
                                    reject("Failed to read Bookalope data (" + reader.error.name + ")");
                                } else {

                                    // A returned data URL must match this pattern.
                                    var matches = reader.result.match(/data:(.*);base64,(.*)/);
                                    if (matches) {

                                        // Get the MIME type of the content, and the Base64 encoded content data.
                                        var mime = matches[1];
                                        var data = matches[2];

                                        // Write the content data. If all goes well, fulfill the Promise we made
                                        // or reject it if writing failed.
                                        var result = window.cep.fs.writeFile(filename, data, window.cep.encoding.Base64);
                                        if (result.err) {
                                            reject("Failed to write file (" + result.err + ")");
                                        } else {
                                            resolve(filename);
                                        }
                                    } else {
                                        reject("Malformed data returned from Bookalope");
                                    }
                                }
                            });
                            reader.readAsDataURL(blob);
                        })
                        .catch(function (error) {
                            reject(error);
                        });
                    } else if (status_ === "failed" || status_ === "none") {
                        window.clearInterval(intervalID);
                        reject(new BookalopeError("Failed to convert document to " + format + " ('" + style + "' style)"));
                    } else {
                        // Status is "processing", so do nothing and keep waiting.
                    }
                })
                .catch(function (error) {
                    reject(error);
                });
            }, 5000, bookflow);
        })
        .catch(function (error) {
            reject(error);
        });
    });
}


/**
 * Given a Bookalope Bookflow object, converts the book into the given file format
 * and saves the converted file. Before saving we pop open a file dialog and ask the
 * user where to save the file.
 *
 * @param {Bookflow} bookflow - A valid Bookflow object referencing a server-side document conversion.
 * @param {string} format - Convert the given document to this format.
 * @param {string} style - The styling for the converted InDesign story.
 */

function askSaveBookflowFile(bookflow, format, style) {
    showStatus("Converting and downloading Bookalope file");
    showSpinner();

    // Ask the user where to save the downloaded file.
    var filename = bookflow.id + "." + format;
    var result;
    result = window.cep.fs.showSaveDialogEx("Save " + format + " file...", "", [format], filename);
    if (result.err) {
        showClientError("Failed to open file dialog (" + result.err + ")");
        hideSpinner();
    } else {

        // Save the downloaded file to the local host filesystem.
        saveBookflowFile(bookflow, format, style, result.data)
        .then(function (filename) {
            showStatusOk();
            hideSpinner();
        })
        .catch(function (error) {
            showClientError(error);
            hideSpinner();
        });
    }
}


// This is where the magic begins.
(function () {

    // The BookalopeClient object that helps us talk to the server, and the Bookalope API token.
    var bookalope;
    var bookalopeToken;
    var bookalopeBetaHost;

    // Tis where we keep the current inputs from the panel.
    var bookFileType;
    var bookFileName;
    var bookFilePath;
    var bookFile;
    var bookName;
    var bookAuthor;
    var bookLocale;
    var bookCopyright;
    var bookPubDate;
    var bookIsbn;
    var bookPublisher;
    var bookVersion;
    var bookAutoClean;
    var bookHighlightIssues;
    var bookSkipStructure;


    /**
     * Helper function which returns an existing BookalopeClient object, or creates
     * a new one.
     *
     * @returns {BookalopeClient}
     */

    function getBookalope() {
        if (bookalope === undefined) {
            bookalope = new BookalopeClient();
        }
        var token = bookalopeBetaHost ? bookalopeBetaToken : bookalopeProdToken;
        if (isToken(token)) {
            bookalope.setToken(token);
        }
        bookalope.setHost(bookalopeBetaHost);
        return bookalope;
    }


    /**
     * After showing the Update panel, we need to make sure that the links responds to the
     * correct and current Bookflow attached to the active InDesign document. This function
     * updates the links of the panel to do exactly that.
     *
     * @param {Bookflow} bookflow - The Bookflow of the active document.
     */

    function setBookalopeLinks(bookflow) {

        /**
         * Helper function that takes an anchor element and attaches the given handler
         * to the element's click events (and removes all existing handlers before).
         *
         * @param {Element} el - An anchor element.
         * @param {Function} handler - The handler function for the element's "click" event.
         */

        function addClickListener(el, handler) {
            var clone = el.cloneNode(true);
            clone.addEventListener("click", handler);
            el.parentNode.replaceChild(clone, el);
        }

        /**
         * Helper function that takes a URL and opens that URL in a browser.
         *
         * @param {string} url - The URL for the browser.
         */

        function openURL(url) {
            var result = window.cep.util.openURLInDefaultBrowser(url);
            if (result.err) {
                showClientError("Failed to open web browser (" + result.err + ")");
            }
        }


        // Bind click handler functions to the links. Because we're using anonymous
        // handler functions here, we can't remove them easily and have to jump through
        // odd hoops (see helper function).
        addClickListener(document.getElementById("a-bookalope"), function () {
            var url = bookflow.getWebURL();
            openURL(url);
            return false;
        });
        addClickListener(document.getElementById("a-purchase"), function () {
            var bookalope = getBookalope();
            var url = bookalope.getHost() + "/plans";
            openURL(url);
            return false;
        });
        addClickListener(document.getElementById("button-download"), function () {
            var bookDownload = document.getElementById("input-book-download").value;
            askSaveBookflowFile(bookflow, bookDownload, "default");
            return false;
        });
        addClickListener(document.getElementById("button-refresh"), function () {
            showSpinner();
            convert(bookflow);
            return false;
        });

        // Depending on the Bookflow's current credit type, show/hide notes for the user.
        if (bookflow.credit === "pro") {
            document.getElementById("div-bookflow-type-none").classList.add("hidden");
            document.getElementById("div-bookflow-type-basic").classList.add("hidden");
        } else if (bookflow.credit === "basic") {
            document.getElementById("div-bookflow-type-none").classList.add("hidden");
            document.getElementById("div-bookflow-type-basic").classList.remove("hidden");
        } else {
            document.getElementById("div-bookflow-type-none").classList.remove("hidden");
            document.getElementById("div-bookflow-type-basic").classList.add("hidden");
        }
    }


    /**
     * Given the Bookflow, convert and download an IDML file and write that file to the
     * local file system as a temporary file. Then invoke the InDesign side and open that
     * IDML file as a new document there. When that returns, delete the IDML file.
     *
     * @param {Bookflow} bookflow - The Bookflow.
     */

    function convert(bookflow) {
        showStatus("Converting and downloading file");

        // Produce a random file name to unique the IDML file.
        var fpath = config.fs.tmp + config.fs.separator + makeUUID4() + ".idml";

        // Convert the given Bookflow's document to IDML, and save it as a temporary file.
        saveBookflowFile(bookflow, "idml", "default", fpath)
        .then(function (filename) {
            showStatus("Building InDesign document");

            // Create the new document on the InDesign side, and pass the Book and Bookflow
            // IDs along to store them with the document. That way, we can update the panel
            // based on the currently active InDesign document. Note that we need to escape
            // backslash characters in the path string to make sure they arrive safely on the
            // other side in application/JSX land!
            var script = "bookalopeCreateDocument('" + filename.replace(/\\/g, "\\\\") + "', '" + bookflow.book.id + "', '" + bookflow.id + "', " + bookalopeBetaHost + ");";
            csInterface.evalScript(script, function (result) {

                // Check for errors during evalScript. Note that the EvalScript_ErrMessage
                // string is defined in CSInterface.js and thus available; would be nice
                // if that was scoped though.
                if (result === EvalScript_ErrMessage) {
                    showClientError("Failed to build document: " + result);
                    hideSpinner();
                } else {

                    // Delete the temporary IDML file.
                    result = window.cep.fs.deleteFile(filename);
                    if (result.err) {
                        // TODO Handle error here: let the temporary IDML file leak quietly? Yup.
                    }

                    // Update links to Bookalope and then switch from the Upload panel to
                    // to the Update panel view.
                    setBookalopeLinks(bookflow);
                    showUpdate();
                    showStatusOk();
                    hideSpinner();
                }
            });
        })
        .catch(function (error) {
            showServerError(error.message);
            hideSpinner();
        });
    }


    /**
     * Given the Bookflow, read and upload the document file and some additional Bookflow
     * information to Bookalope. Uploading will trigger the analysis and content extraction.
     * Then wait until the Bookflow step changes from 'processing' to 'convert' which indicates
     * successful analysis; 'processing-failed' would indicate that the analysis failed. Once
     * the analysis succeeded, continue to convert and download the IDML for this document.
     *
     * @param {Bookflow} bookflow - The Bookflow.
     *
     */

    function uploadFile(bookflow) {
        showStatus("Uploading and analyzing document");

        // Read the book file, either the selected one or the created one.
        var result = window.cep.fs.readFile(bookFilePath, window.cep.encoding.Base64);
        if (result.err) {
            showElementError(document.getElementById("input-file"), "Unable to load file (" + result.err + ")");
            hideSpinner();
        } else {

            // Passing `undefined` as document type to setDocument() causes the server to
            // determine the type of the uploaded file. Also note that result.data is a
            // base-64 encoded binary, so we have to decode it before passing it to the
            // Bookalope wrapper. The wrapper will then encode it (again) before shipping
            // it off to the server.
            bookflow.setDocument(bookFileName, atob(result.data), undefined, bookSkipStructure, bookUploadOptions)
            .then(function (bookflow) {

                // Periodically poll the Bookalope server to update the Bookflow. Then check
                // the step property for the current processing status of the Bookalope, and
                // act accordingly.
                var intervalID = window.setInterval(function (bookflow) {
                    bookflow.update()
                    .then(function (bookflow) {
                        if (bookflow.step === "processing") {
                            // Bookalope is still processing, keep waiting.
                        } else if (bookflow.step === "processing_failed") {
                            window.clearInterval(intervalID);
                            showServerError("Bookalope failed to process the document");
                            hideSpinner();
                        } else if (bookflow.step === "convert") {
                            window.clearInterval(intervalID);
                            convert(bookflow);
                        }
                    })
                    .catch(function (error) {
                        window.clearInterval(intervalID);
                        showServerError(error.message);
                        hideSpinner();
                    });
                }, 5000, bookflow);
            })
            .catch(function (error) {
                showServerError(error.message);
                hideSpinner();
            });
        }
    }


    /**
     * Create a new Book and Bookflow on the Bookalope server, and the start uploading
     * and converting the user's document.
     */

    function createBook() {
        showStatus("Creating Book and Bookflow");

        // Get the BookalopeClient object.
        var bookalope = getBookalope();

        // Create a new Book, which then contains an empty Bookflow. That is the
        // Bookfow we'll work with. Note that the user will see both Book and Bookflow
        // when she logs into the website.
        bookalope.createBook(bookName)
        .then(function (book) {
            var bookflow = book.bookflows[0];
            bookflow.name = bookName;
            bookflow.title = bookName;
            bookflow.author = bookAuthor;
            bookflow.copyright = bookCopyright;
            bookflow.isbn = bookIsbn;
            bookflow.locale = bookLocale;
            bookflow.pubdate = bookPubDate;
            bookflow.publisher = bookPublisher;
            bookflow.save()
            .then(function () {

                // If the user wants to apply a plan credit to this Bookflow, then do
                // so now before we upload the file to the server. If that fails, just
                // continue and let the user sort it out through the website later.
                if (bookCredit) {
                    bookflow.setCredit("pro")
                    .then(function () {
                        uploadFile(bookflow);
                    })
                    .catch(function (error) {
                        uploadFile(bookflow);
                    });
                } else {
                    uploadFile(bookflow);
                }
            })
            .catch(function (error) {
                showServerError(error.message);
                hideSpinner();
            });
        })
        .catch(function (error) {
            showServerError(error.message);
            hideSpinner();
        });
    }


    /**
     * The user has selected an existing file, so use its path and create the new Book and
     * Bookflow using the selected file.
     */

    function createBookFromSelectedFile() {
        showSpinner();

        bookFileName = bookFile.name;
        bookFilePath = bookFile.path;
        createBook();
    }


    /**
     * The user wants to upload the currently active document. Because Bookalope doesn't
     * support InDesign file formats (will it ever?) we first save the active document as
     * a local RTF file and then upload that RTF file to Bookalope.
     */

    function createBookFromActiveDocument() {
        showSpinner();
        showStatus("Preparing active document");

        // Noodle through the active document to create an RTF file, and save that.
        // If everything went well, create the Book and upload the file.
        csInterface.evalScript("bookalopeActiveDocumentToRTF();", function (result) {
            bookFilePath = JSON.parse(result);
            if (bookFilePath === false) {
                showElementError(document.getElementById("input-active-document"), "Failed to prepare active document");
                hideSpinner();
            } else {
                bookFileName = bookFilePath.split("/").pop().split("\\").pop();
                bookUploadOptions = {"ignore_pagebreaks": true};
                createBook();
            }
        });
    }


    /**
     * When the user clicks the "Upload and Convert", then we create a new Book and Bookflow
     * for the given document, upload the given file, and when converted, download the IDML
     * and open it in a new InDesign document. All that is being kicked off by this handler
     * function.
     */

    function uploadAndConvertDocument() {

        // Get the values from the form fields.
        bookalopeToken = document.getElementById("input-bookalope-token").value;
        bookalopeBetaHost = document.getElementById("input-bookalope-beta").checked;
        bookFileType = document.querySelector("input[name='input-file-type']:checked").value;
        bookFileName = undefined;
        bookFilePath = undefined;
        bookFile = document.getElementById("input-file").files[0];
        bookActiveDocument = document.getElementById("input-active-document").value;
        bookName = document.getElementById("input-book-name").value;
        bookAuthor = document.getElementById("input-book-author").value;
        bookCopyright = document.getElementById("input-book-copyright").value;
        bookLocale = document.getElementById("input-book-language").value;
        bookPubDate = document.getElementById("input-book-pubdate").value;
        bookIsbn = document.getElementById("input-book-isbn").value;
        bookPublisher = document.getElementById("input-book-publisher").value;
        bookCredit = document.getElementById("input-book-credit").checked;
        bookAutoClean = document.getElementById("input-book-autoclean").checked;
        bookHighlightIssues = document.getElementById("input-book-highlight-issues").checked;
        bookSkipStructure = document.getElementById("input-book-skip-structure").checked;
        bookUploadOptions = undefined;

        // Hide error messages and clear out highlighted fields, if there are any.
        clearErrors();

        // Check for errors of the input fields. If everything is good then
        // upload the document to Bookalope for conversion.
        if (!isToken(bookalopeToken)) {
            showElementError(document.getElementById("input-bookalope-token"), "Field is required");
            document.getElementById("input-bookalope-token").scrollIntoView(false);
        }
        else if (bookName.length === 0) {
            showElementError(document.getElementById("input-book-name"), "Field is required");
            document.getElementById("input-book-name").scrollIntoView(false);
        }
        else if (bookFileType === "open-file") {
            if (bookFile === undefined) {
              showElementError(document.getElementById("input-file"), "Field is required");
              document.getElementById("input-file").scrollIntoView(false);
            }
            else if (bookFile.size > 268435456) { // 256MiB
                showElementError(document.getElementById("input-file"), "File size exceeded 12Mb");
                document.getElementById("input-file").scrollIntoView(false);
            }
            else {
                createBookFromSelectedFile();
            }
        }
        else if (bookFileType === "active-document") {
            if (!bookActiveDocument) {
                showElementError(document.getElementById("input-active-document"), "Field is required");
                document.getElementById("input-active-document").scrollIntoView(false);
            }
            else {
                createBookFromActiveDocument();
            }
        }
        else {
            // The above should cover it.
        }
    }


    /**
     * Read configuration data from the Bookalope server, and update the
     * panels accordingly.
     */

    function refreshPanelsFromServerConfiguration() {

        // Create and return a new Promise.
        return new Promise(function (resolve, reject) {

            /**
             * Given the id of a DOM <select> element and an array of `[text, value]`
             * tuples for the select's options, remove all existing <option> elements
             * from the <select> and rebuild & insert new ones.
             */

            function refreshSelectOptions(selectId, options) {
                var select = document.getElementById(selectId),
                    selectValue = select.value;
                    selectValueExists = false;

                select.options.length = 0;
                options.forEach(function ([value, text]) {
                    select.appendChild(new Option(text, value));
                    if (value === selectValue) {
                        selectValueExists = true;
                    }
                });
                if (selectValueExists) {
                    select.value = selectValue;
                } else {
                    select.value = "";
                    select.selectedIndex = -1;
                }
            }

            // An array of [text, value] tuples for a <select> element's new options.
            var options = [];

            // Fetch the languages from the server so we can populate the language <select> element.
            var bookalope = getBookalope();
            bookalope.getLanguages()
            .then(function (languageList) {
                languageList.forEach(function (language) {
                    options.push([language.locale, language.name]);
                });
                refreshSelectOptions("input-book-language", options);
                refreshSpectrumDropdowns();
                resolve();
            })
            .catch(function (error) {
                options.push(["en-US", "English (United States)"]);
                refreshSelectOptions("input-book-language", options);
                refreshSpectrumDropdowns();
                reject(error);
            });

            // TODO Consider fetching getExportFormats() from the server.
            document.getElementById("input-book-download").value = "";
            document.getElementById("input-book-download").selectedIndex = -1;
        });
    }


    /**
     * Here we handle when the user switches between different InDesign documents, or when
     * we've successfully created a new InDesign document. Either way, we need to show the
     * correct panel for the new active InDesign document. Chains to the given callback
     * function, if any.
     */

    function switchPanel() {

        // Get the private Bookalope data from the now active document.
        csInterface.evalScript("bookalopeGetDocumentDataFromActive();", function (result) {

            // The result is either null or a JSON serialized dictionary with information
            // about the currently active InDesign document as well as Bookalope data
            // (including the bookflow id). When InDesign switches to a document with a
            // bookflow id, then show the Update panel; else show the Upload panel from
            // which we create a new document.
            var documentData = JSON.parse(result);
            if (documentData) {

                // Update the "Active Document" field with the currently active document name.
                document.getElementById("input-active-document").value = documentData.doc.name;

                // Fetch the Bookalope specific data.
                var bookalopeData = documentData.bookalope;
                if (bookalopeData) {

                    // Get Book and Bookflow IDs, as well as beta host information.
                    var bookId = bookalopeData["book-id"];
                    var bookflowId = bookalopeData["bookflow-id"];
                    // TODO Paranoid: (/^[0-9a-fA-F]{32}$/).test(bookId), (/^[0-9a-fA-F]{32}$/).test(bookflowId)

                    // Handle beta host information from the document.
                    if (bookalopeBetaHost !== bookalopeData["beta"]) {
                        showClientError("Document " + (bookalopeData["beta"] ? "uses" : "doesn't use") + " beta server, please check token");
                    }

                    // Create a new Book and Bookflow object. Note that creating them does not
                    // talk with the Bookalope server, it merely instantiates the corresponding
                    // objects with enough information to talk with the Bookalope server.
                    var bookalope = getBookalope();
                    var book = new Book(bookalope, bookId);
                    var bookflow = new Bookflow(bookalope, book, bookflowId);

                    // Update the local Bookflow object with data from the Bookalope server. If that
                    // succeeds then bind the correct handlers to the links and show the Update panel;
                    // if updating the Bookflow failed then show the Upload panel and error message.
                    bookflow.update()
                    .then(function (bookflow) {
                        setBookalopeLinks(bookflow);
                        showUpdate();
                        showStatusOk();
                    })
                    .catch(function (error) {
                        showUpload();
                        showServerError(error.message);
                    });
                } else {
                    showUpload();
                    showStatusOk();
                }
            } else {
                showUpload();
                showStatusOk();
            }
        });
    }


    /**
     * Given a skin info compute the matching color scheme and, if it has changed compared
     * to the application's current scheme change to the new scheme.
     */

    function updateThemeWithAppSkinInfo(appSkinInfo) {

        // Update the theme of the extension panel.
        var theme = undefined;
        var sentinelColor = appSkinInfo.panelBackgroundColor.color.red;
        if (sentinelColor > 200) {
            theme = "lightest";
        } else if (sentinelColor > 180) {
            theme = "light";
        } else if (sentinelColor > 67) {
            theme = "dark";
        } else {
            theme = "darkest";
        }

        // Based on the theme's name switch classes and CSS files accordingly.
        var body = document.querySelector("body");
        var currentTheme = body.getAttribute("data-theme");
        if (theme !== currentTheme) {
            body.setAttribute("data-theme", theme);
            body.classList.remove("spectrum--" + currentTheme);
            body.classList.add("spectrum--" + theme);

            // Switch the CSS files.
            document.querySelectorAll("link[data-theme-css]").forEach(function (link) {
                link.setAttribute("href", link.getAttribute("data-theme-css") + theme + ".css");
            });
        }
    }


    // First things first: get and initialize the Creative Suite Interface. There is much
    // speculation as to what CS stands for: https://adobedevs.slack.com/archives/C1F8U99S7/p1561952315033200
    var config;
    var csInterface = new CSInterface();
    var resourceBundle = csInterface.initResourceBundle();

    // The ThemeManager handles the extension's color theme based on InDesign's scheme. So first
    // get a latest HostEnvironment object from the application, and then install an event
    // handler that's being called every time InDesign's color scheme changes.
    updateThemeWithAppSkinInfo(csInterface.hostEnvironment.appSkinInfo);
    csInterface.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, function (csEvent) {
        var hostEnv = window.__adobe_cep__.getHostEnvironment();
        var appSkinInfo = JSON.parse(hostEnv).appSkinInfo;
        updateThemeWithAppSkinInfo(appSkinInfo);
    });

    // Fetch the InDesign configuration data build the extension panels.
    csInterface.evalScript("getConfiguration();", function (result) {
        config = JSON.parse(result);

        // Make sure all the necessary features are available. If not, then show a simple
        // error message and an otherwise empty panel. If all features are available, however,
        // then show the appropriate panel. TODO This should never happen, we know the Chrome versions.
        var missingFeatures = detectFeatures();
        if (missingFeatures.length) {

            // Build a somewhat verbose error message.
            var message = "Insufficient feature set<br><br>";
            message += "User agent: " + navigator.userAgent + "<br><br>";
            message += "InDesign: " + config.app.version + "<br><br>";
            message += "Unsupported features: " + missingFeatures.join(", ");
            showClientError(message);

        } else {

            // Get the Bookalope API token and beta host flag if it's been stored before, and make
            // them the value of their respective elements.
            var bookalopeTokenInfo = getBookalopeAPITokens();
            bookalopeProdToken = bookalopeTokenInfo.tokenProd;
            bookalopeBetaToken = bookalopeTokenInfo.tokenBeta;
            bookalopeBetaHost = bookalopeTokenInfo.useBetaHost;
            document.getElementById("input-bookalope-token").value = bookalopeBetaHost ? bookalopeBetaToken : bookalopeProdToken;
            document.getElementById("input-bookalope-beta").checked = bookalopeBetaHost;

            // Add a few relevant event handlers to catch changes from the other side.
            csInterface.addEventListener("documentAfterActivate", function (csEvent) {
                switchPanel();
            });
            csInterface.addEventListener("documentBeforeClose", function (csEvent) {
                if (csEvent.data === 1) {
                    showUpload();
                    showStatusOk();
                }
            });

            // Register the callback for the Convert button.
            document.getElementById("button-send").addEventListener("click", function () {
                uploadAndConvertDocument();
            });

            // Register the callbacks for the Document Type radio buttons.
            document.getElementById("input-file-open").addEventListener("change", function (event) {
                document.getElementById("input-file").closest(".spectrum-FieldGroup-item").classList.remove("hidden");
                document.getElementById("input-active-document").closest(".spectrum-FieldGroup-item").classList.add("hidden");
            });
            document.getElementById("input-file-active").addEventListener("change", function (event) {
                document.getElementById("input-file").closest(".spectrum-FieldGroup-item").classList.add("hidden");
                document.getElementById("input-active-document").closest(".spectrum-FieldGroup-item").classList.remove("hidden");
            });

            // Register the callback for the File selection field that shows the selected
            // file name or, if no file was selected, a default string from data-placeholder attribute.
            document.getElementById("input-file").addEventListener("change", function (event) {
                var label = this.parentNode.querySelector(".file__label");
                if (this.files.length) {
                    label.classList.remove("is-placeholder");
                    label.textContent = event.target.value.split("\\").pop();
                } else {
                    label.classList.add("is-placeholder");
                    label.textContent = this.getAttribute("data-placeholder");
                }
            });

            // Register the callback for the Token update that saves changes of the token
            // field to the localStorage.
            document.getElementById("input-bookalope-token").addEventListener("change", function (event) {
                var token = event.currentTarget.value;
                if (token === "" || isToken(token)) {
                    var betaHost = document.getElementById("input-bookalope-beta").checked;
                    if (betaHost) {
                        bookalopeBetaToken = token;
                    } else {
                        bookalopeProdToken = token;
                    }
                    setBookalopeAPITokens(bookalopeProdToken, bookalopeBetaToken, bookalopeBetaHost);
                    clearErrors();
                    showStatus("Refreshing panels...");
                    refreshPanelsFromServerConfiguration()
                    .then(function() {
                        showStatusOk();
                    })
                    .catch(function(error) {
                        // Don't show an error and default panel elements.
                        showStatusOk();
                    });
                } else {
                    showElementError(event.currentTarget, "Invalid Bookalope token format");
                }
            });

            // Register the callback for the Beta checkbox.
            document.getElementById("input-bookalope-beta").addEventListener("change", function (event) {
                bookalopeBetaHost = event.currentTarget.checked;
                if (bookalopeBetaHost) {
                  document.getElementById("input-bookalope-token").value = bookalopeBetaToken;
                } else {
                  document.getElementById("input-bookalope-token").value = bookalopeProdToken;
                }
                showStatus("Refreshing panels...");
                refreshPanelsFromServerConfiguration()
                .then(function() {
                    showStatusOk();
                })
                .catch(function(error) {
                    // Don't show an error and default panel elements.
                    showStatusOk();
                });
            });

            // And finally, refresh both Upload and Update panels from the server configs.
            showStatus("Refreshing panels...");
            refreshPanelsFromServerConfiguration()
            .then(function() {
                showStatusOk();
                switchPanel();
            })
            .catch(function(error) {
                // Don't show an error and default panel elements.
                showStatusOk();
                switchPanel();
            });
        }
    });

    // Load all SVG icons used by the extension so that they become available to the <svg> elements.
    loadIcons("images/spectrum-icons.svg");
}());
