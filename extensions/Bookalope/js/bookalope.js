/*jslint browser: true, devel: true */
/*global window, document, navigator, atob */
/*global Promise, Blob, FileReader, CustomEvent, localStorage, CSInterface */
/*global BookalopeClient, BookalopeError, Book, Bookflow */


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
 * Retrieve the user's Bookalope API token and beta host flag that's stored by Chromium,
 * or return default values if they weren't found.
 *
 * See also: https://developer.mozilla.org/en/docs/Web/API/Window/localStorage
 *
 * @returns {object} The user's Bookalope API token and whether to access Bookalope's beta host.
 */

function getBookalopeAPIToken() {
    var token = "";
    var beta = false;
    if (typeof localStorage === "object") {
        token = localStorage.getItem("idsn_extension_bookalope_api_token");
        beta = localStorage.getItem("idsn_extension_bookalope_beta_host") === "true";
    }
    return {token: token, beta: beta};
}


/**
 * Store the given Bookalope API token and beta host flag for later use. Makes it easier
 * for the user so she doesn't have to keep entering the token between sessions.
 *
 * See also: https://developer.mozilla.org/en/docs/Web/API/Window/localStorage
 *
 * @param {string} token - A valid Bookalope token.
 * @param {boolean} beta - Flag indicating whether the token is valid for the beta host.
 */

function setBookalopeAPIToken(token, beta) {
    if (typeof localStorage === "object") {
        localStorage.setItem("idsn_extension_bookalope_api_token", token);
        localStorage.setItem("idsn_extension_bookalope_beta_host", beta);
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
 * Unblock metadata fields (currently only language picker)
 */

function unblockMetaData() {
    document.querySelector("div[data-id='input-book-language'] > button").classList.remove("is-disabled");
}


/**
 * Block metadata fields (currently only language picker)
 */

function blockMetaData() {
    let node = document.querySelector("#input-book-language").parentNode.querySelector("button");
    if(node) {
        node.classList.add("is-disabled");
    }
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
    showStatus("Ok (v1.3.1)");
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
    var bookLanguage;
    var bookCopyright;
    var bookPubDate;
    var bookIsbn;
    var bookPublisher;
    var bookVersion;
    var bookAutoClean;
    var bookHighlightIssues;
    var bookSkipStructure;

    // Other additions
    let tokenChangeTimeout;

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
        bookalope.setToken(bookalopeToken);
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
            bookflow.language = bookLanguage;
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

        // Store the API authentication key to local storage for later.
        bookalopeToken = document.getElementById("input-bookalope-token").value;
        bookalopeBetaHost = document.getElementById("input-bookalope-beta").checked;
        setBookalopeAPIToken(bookalopeToken, bookalopeBetaHost);

        // Get the values from the form fields.
        bookFileType = document.querySelector("input[name='input-file-type']:checked").value;
        bookFileName = undefined;
        bookFilePath = undefined;
        bookFile = document.getElementById("input-file").files[0];
        bookActiveDocument = document.getElementById("input-active-document").value;
        bookName = document.getElementById("input-book-name").value;
        bookAuthor = document.getElementById("input-book-author").value;
        bookCopyright = document.getElementById("input-book-copyright").value;
        bookLanguage = document.getElementById("input-book-language").value;
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


    /*
     * Picker code
     * Starting with generic helper functions.
     */

    /*
     * Helper function for the picker element.
     * Return true if the `element` itself or any of its ancestor elements match
     * the given `selector`; or false otherwise.
     */

    function isAncestorOf(element, selector) {

        // If the element itself matches, then we're done already.
        if (element.matches(selector)) {
            return true;
        }

        // Ascend along the ancestor elements and check.
        // See https://developer.mozilla.org/en-US/docs/DOM/Node.nodeType
        let parent = element.parentNode;
        while (parent && parent.nodeType && parent.nodeType === 1) {
            if (parent.matches(selector)) {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
    }


    /*
     * Helper function for the picker element.
     * Close the given Dropdown's popover element.
     */

    function closeDropdown(dropdown) {
        dropdown.classList.remove("is-open");
        dropdown.classList.remove("is-dropup");
        let dropdownPopover = dropdown.querySelector(".dropdown-select__popover");
        if (dropdownPopover !== null) {
            // This should always exist, no?
            dropdownPopover.classList.remove("is-open");
            dropdown.classList.remove("spectrum-Popover--top");
            dropdown.classList.add("spectrum-Popover--bottom");
        }
    }


    /**
     * Helper function for the picker element.
     * Iterate over all Spectrum Dropdown elements and close their respective
     * popover elements. If an exception Dropdown is specified then do not close
     * its popover.
     */

    function closeAllDropdowns(exception) {
        document.querySelectorAll(".dropdown-select").forEach(function (dropdown) {
            if (dropdown !== exception) {
                closeDropdown(dropdown);
            }
        });
    }


    // (Note: original comments were kept)
    // Alright this is a funky Adobe Spectrum thing. Looking at the documentation for
    // Picker elements: https://opensource.adobe.com/spectrum-css/picker.html
    // then Spectrum switches a <select> element to `hidden` and instead uses its own
    // implementation; however, it's required to keep the <select> element and to sync
    // its <option> values with the Spectrum Picker to make sure that forms continue
    // to work. A bit spunky, but that's how they do it, I guess 😳
    // Note: we use the Javascript idiom here that declares an anonymous function and
    // executes it, in order to use the function's closure.
    function buildPickers() {

        // Here it goes. Iterate over all <select> elements in the documents (assuming
        // that they have a class 'spectrum-Picker-select') and hide them; then
        // create the Adobe Spectrum specific Dropdowns in their stead.
        document.querySelectorAll(".spectrum-Picker-select").forEach(function (select) {

            // Get the <select> element's options; its "placeholder" (which is the label shown
            // when no option is selected); and its id attribute.
            //var selectOptions = select.children,
            let selectPlaceholder = select.getAttribute("data-placeholder");
            let selectId = select.getAttribute("id");

            // Hide the original <select> element, but we need to keep it in the DOM to ensure
            // that its value is used by the outer form.
            select.classList.add("hidden");

            // Build the fancy-schmancy Spectrum Dropdown as an HTML string. For more details
            // on how this works, take a look at the docs:
            //   http://opensource.adobe.com/spectrum-css/2.13.0/docs/#dropdown
            // When done, add the HTML into the DOM right after the original <select> element.
            let dropdownHTML = "";
            dropdownHTML += "<div class='dropdown-select' data-id='" + selectId + "'>";
            dropdownHTML += "<button class='spectrum-Picker spectrum-Picker--sizeM dropdown-select__trigger'>" +
                "<span class='spectrum-Picker-label dropdown-select__label is-placeholder'>" + selectPlaceholder + "</span>" +
                "<svg class='spectrum-Icon spectrum-Icon--sizeM spectrum-Picker-validationIcon' focusable='false' aria-hidden='true' aria-label='Alert'><use xlink:href='#spectrum-icon-18-Alert'></use></svg>" +
                "<svg class='spectrum-Icon spectrum-UIIcon-ChevronDown100 spectrum-Picker-menuIcon dropdown-select__icon' focusable='false' aria-hidden='true'><use xlink:href='#spectrum-css-icon-Chevron100'/></svg>" +
                "</button>";
            dropdownHTML += "<div class='spectrum-Popover spectrum-Popover--bottom spectrum-Picker-popover dropdown-select__popover'>" +
                "<ul class='spectrum-Menu' role='listbox'>";

            dropdownHTML += "</ul></div></div>";
            select.insertAdjacentHTML("afterend", dropdownHTML);

            // Now that the Dropdown is inserted into the DOM, attach the required event handlers
            // so that it behaves like a proper replacement for the <select> element.
            let dropdown = document.querySelector(".dropdown-select[data-id='" + selectId + "']");
            let dropdownTrigger = dropdown.querySelector(".dropdown-select__trigger");

            // Notice that a Spectrum Dropdown also has a <button> that acts as the Dropdown's
            // "trigger" i.e. it opens the popover with the menu items. Here we bind a "click"
            // event handler that toggles that popover.
            dropdownTrigger.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (this.classList.contains("is-disabled") === false) {

                    // If the popover is open, then close it.
                    var dropdown = this.parentNode;
                    if (dropdown.classList.contains("is-open")) {
                        closeDropdown(dropdown);
                    } else {

                        /**
                         * Compute the effective height of the given DOM element.
                         */

                        function getHeight(element) {

                            // If the element is displayed, then return its normal height.
                            let elementStyle = window.getComputedStyle(element);
                            if (elementStyle.display !== "none") {
                                let maxHeight = elementStyle.maxHeight.replace("px", "").replace("%", "");
                                if (maxHeight !== "0") {
                                    return element.offsetHeight;
                                }
                            }

                            // The element is currently not displayed, so its height has not been
                            // computed. To fake that, hide the element but display it and grab
                            // its height. Then put it all back.
                            element.style.position = "absolute";
                            element.style.visibility = "hidden";
                            element.style.display = "block";

                            let height = element.offsetHeight;

                            // TODO Restore the original values, instead of overwriting them here.
                            element.style.position = "";
                            element.style.visibility = "";
                            element.style.display = "";

                            return height;
                        }

                        // This Dropdown is about to open its popover, so close the popovers of
                        // of all other Dropdowns first. (This should only be one.)
                        closeAllDropdowns(dropdown);

                        // Make sure that the popover shows correctly in the ancestor's panel <div>.
                        let panel = dropdown.closest(".panel__body");  // Or use <body>.
                        let dropdownPopover = dropdown.querySelector(".dropdown-select__popover");

                        // Check whether there is enough room below the Dropdown to open the
                        // popover below; if there is not, then open the popover above the Dropdown.
                        // TODO The popover is always not displayed yet, simplify getHeight() function!
                        let popoverHeight = getHeight(dropdownPopover);
                        if (dropdown.parentNode.offsetTop > popoverHeight) {
                            let top = dropdown.parentNode.offsetTop + dropdown.offsetHeight + popoverHeight;
                            if (top > panel.offsetHeight + panel.scrollTop) {
                                dropdown.classList.add("is-dropup");
                                dropdownPopover.classList.remove("spectrum-Popover--bottom");
                                dropdownPopover.classList.add("spectrum-Popover--top");
                            }
                        }

                        // Open the Dropdown's popover.
                        dropdown.classList.add("is-open");
                        dropdownPopover.classList.add("is-open");
                    }
                }
            });

        });
    }


    /**
	 * Generate the Picker menu items (<li> objects), for an existing Picker build with buildPickers()
     * Called separately from buildPickers.
     *
     * @param {string} selectID - ID string shared by the <select> (as ID) and Picker (as data-id)
     *
     */

    function populatePickerItems(selectId) {

        let select = document.querySelector("select#" + selectId);
        let dropdown = document.querySelector(".dropdown-select[data-id='" + selectId + "']");

        if(select === null || dropdown === null) {
            return; // Warn?
        }

        let dropdownMenu = dropdown.querySelector("div > ul");

        /**
         * Change the current label of a Dropdown.
         */

        function changeDropdownLabel(newValue, newLabel, isPlaceholder) {
            dropdownLabel.textContent = newLabel;
            dropdownLabel.setAttribute("data-value", newValue);
            dropdownLabel.classList.toggle("is-placeholder", isPlaceholder === true);
        }

        /**
         * A new value was selected using the Dropdown, which now has to be propagated
         * to the original <select> element's option. This function takes care of that.
         */

        function changeSelectValue(newValue, newLabel) {

            // Close the Dropdown's popover.
            dropdown.classList.remove("is-open");
            dropdownPopover.classList.remove("is-open");

            // If the value hasn't changed, then do nothing and be done.
            if (select.value === newValue) {
                return;
            }

            // Find the Dropdown's data item which was selected and mark it; likewise
            // remove the selected mark from all other items in the Dropdown.
            let isPlaceholderValue = false;
            dropdownItems.forEach(function (dropdownItem) {
                if (dropdownItem.getAttribute("data-value") === newValue) {
                    dropdownItem.classList.add("is-selected");
                    isPlaceholderValue = dropdownItem.classList.contains("is-placeholder");
                } else {
                    dropdownItem.classList.remove("is-selected")
                }
            });

            // Show the selected value as the Dropdown's label.
            changeDropdownLabel(newValue, newLabel, isPlaceholderValue);

            // Update the original <select> element's value with the Dropdown's selected one.
            select.value = newValue;

            // Send a "change" event to the real <select> element to trigger any change
            // event listeners that might be attached.  TODO There aren't any currently.
            let changeEvent = new CustomEvent("change");
            select.dispatchEvent(changeEvent);
        }

        // Remove previous Picker list (<li>) elements
        // This should also remove associated event handlers
        while(dropdownMenu.firstChild) {
            dropdownMenu.removeChild(dropdownMenu.firstChild);
        }

        // Get the <select> element's options.
        let selectOptions = select.children; // !live
        let dropdownLabel = dropdown.querySelector(".dropdown-select__label");

        // Default to placeholder value on no selected option, or no options (length = 0)
        if(select.selectedIndex < 0 || !selectOptions.length) {
            let placeholderText = select.getAttribute('data-placeholder') || "";
            changeDropdownLabel("", placeholderText, true);

            // Return if there are no <option> elements
            if(!selectOptions.length) {
                return;
            }
        }

        // Create new Picker menu items
        let dropdownHTML = "";

        Array.from(selectOptions).forEach(function (option) {
            let isPlaceholder = option.getAttribute("data-placeholder") === "true",
                isDivider = option.getAttribute("data-divider") === "true";
            let cssItemClasses = "";
            cssItemClasses += isDivider ? "spectrum-Menu-divider" : "spectrum-Menu-item";
            if (isPlaceholder) {
                cssItemClasses += " is-placeholder";
            }
            if (option.selected === true) {
                cssItemClasses += " is-selected";
            }
            if (option.disabled === true) {
                cssItemClasses += " is-disabled";
            }
            let optionText = option.textContent;
            let optionValue = option.getAttribute("value");
            dropdownHTML += "<li class='" + cssItemClasses + "' data-value='" + optionValue + "' " +
                "role='" + (isDivider ? "separator" : "option") + "'>";
            if (!isDivider) {
                dropdownHTML += "<span class='spectrum-Menu-itemLabel'>" + optionText + "</span>";
                dropdownHTML += "<svg class='spectrum-Icon spectrum-UIIcon-Checkmark100 spectrum-Menu-checkmark spectrum-Menu-itemIcon' focusable='false' aria-hidden='true'><use xlink:href='#spectrum-css-icon-Checkmark100'></use></svg>";
            }
            dropdownHTML += "</li>";
        });

        // Insert the newly generated HTML with Picker menu items into the DOM
        dropdownMenu.insertAdjacentHTML("afterbegin", dropdownHTML);

        let dropdownPopover = dropdown.querySelector(".dropdown-select__popover");
        let dropdownItems = dropdown.querySelectorAll(".spectrum-Menu-item");

        // Iterate over the Dropdown's menu items, bind click handlers to each of them,
        // and set the Dropdown's label to the selected option.
        dropdownItems.forEach(function (dropdownItem) {

            // If the menu item is disabled, skip on to the next.
            if (dropdownItem.classList.contains("is-disabled")) {
                return;  // continue;
            }

            // Bind click handler function to the menu item which, when the item is clicked,
            // updates the Dropdown's label and select's the correct option for the original
            // <select> element.
            dropdownItem.addEventListener("click", function (event) {
                let newValue = this.getAttribute("data-value");
                let newLabel = this.textContent;
                changeSelectValue(newValue, newLabel);
            });

            // If the menu item is the selected one, then update the Dropdown's label.
            let value = dropdownItem.getAttribute("data-value");
            if (value === select.value) {
                changeDropdownLabel(value, dropdownItem.textContent,
                    dropdownItem.classList.contains("is-placeholder"));
            }
        });
    }


    /**
     * End picker related code
     */


    /**
	 * Insert <option> items into the specified <select> tag, and try to restore the
     * previous value (only non-empty value attribute strings).
     *
     * @param {string} targetID: ID of the <select> DOM object
     * @param {array} response: array, with {'value' : '', 'name' : ''} tuples
     * @param {bool} restoreValue: restore the previous value if present, else deselects.
     *
     */

     function populateSelectOptions (targetID, response, restoreValue=true) {

        let target = document.getElementById(targetID);
        let targetOldValue = target.value;
        let targetOldValueWasRestored = false;

        // If nothing was selected, or <select> was empty, don't attempt to restore
        // the value, in case there is a "" option.
        if(targetOldValue === "") {
            restoreValue = true;
        }

        // Clear current <option> tags
        // When dealing with many: https://www.somacon.com/p542.php
        target.options.length = 0;

        // If response is empty, return, having just cleared the old <option> tags.
        if(response.length < 1) {
            return;
        }

        // Create and insert new options from response
        response.forEach ((item) => {
            let label = `${item.name}`;
            target.appendChild(new Option(label, item.value));

            // Restore old value if allowed and possible
            if(restoreValue && item.value === targetOldValue) {
                target.value = targetOldValue;
                targetOldValueWasRestored = true;
            }
        });
        /* In case of compatibility problems, use:
            opt.value = language.code;
            opt.innerHTML = language.name;
            languagePicker.appendChild(opt);
        */

        // If restoreValue is false, deselect all options
        // else, deselect all if old value was not found/restored
        if(!restoreValue || !targetOldValueWasRestored) {
            target.selectedIndex = -1;
        }
    }


    /**
	 * Fetch and insert UI related data from server (languages, download formats)
     *
     */

	function fetchUIServerdata() {

        /*
        * Get language data
        */

        bookalope.fetchLanguages()
        .then(response => {
            // Populate the <select> options, and restore selection (if possible).
            populateSelectOptions("input-book-language", response);

            // Construct a new the picker menu based of the <select> options
            populatePickerItems("input-book-language");
        })
        .catch(error => {
            // Same, but empty the options, thus also clearing the picker menu.
            populateSelectOptions("input-book-language", []);
            populatePickerItems("input-book-language");

            showClientError(error);
        });

        /*
         * Get download format data
         */

        // Formats are currently hardcoded in index.html
        // We still need to construct the picker menu

        populatePickerItems("input-book-download");

    }


    /**
     * On authentication change (= token 'onblur' event), check token validity, and if valid,
     * call functions that fetch and insert UI related data
     *
     */

    function authenticationChanged() {
        clearErrors();

        let token = document.getElementById("input-bookalope-token").value;
        let beta = document.getElementById("input-bookalope-beta").checked;

        if (token === "") {
            // Avoids warning on fresh startup with no token
            blockMetaData();
        } else if (isToken(token)) {
            // On first startup, bookalope object may be undefined. Create it here.
            // If it exists, the token/beta state will be updated.
            bookalopeToken = token;
            bookalopeBetaHost = beta;
            bookalope = getBookalope(); // also uses isToken, error condition can be ignored

            // Store new token/beta locally
            setBookalopeAPIToken(token, beta);

            // Do the actual unblock and data fetching
            unblockMetaData();
            fetchUIServerdata();
        } else {
            blockMetaData();
            showElementError(document.getElementById("input-bookalope-token"), "Invalid Token");
            document.getElementById("input-bookalope-token").scrollIntoView(false);
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
            var bookalopeTokenInfo = getBookalopeAPIToken();
            bookalopeToken = bookalopeTokenInfo.token;
            bookalopeBetaHost = bookalopeTokenInfo.beta;
            document.getElementById("input-bookalope-token").value = bookalopeToken;
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

            // Register the callbacks for a change of authentication data (token/beta)
            // Listening for "keyup" + "paste" covers most situations, except for a context menu "cut" that
            // empties the input (or invalidates the token).
            // That can be listened for using "change" which (like "onblur") triggers when loosing focus;
            // However, currently it will also run after a completed "keyup" and "paste" event. Therefor, ignore
            // this rare situation for now. If needed, the user can press 'enter' after a change.

            // Listen for typed tokens
            document.getElementById("input-bookalope-token").addEventListener("keyup", () => {
                if(tokenChangeTimeout) {
                    clearTimeout(tokenChangeTimeout);
                }
                tokenChangeTimeout = setTimeout(authenticationChanged, 1000);
            });
            // Listen for copy pasted tokens
            document.getElementById("input-bookalope-token").addEventListener("paste", () => {
                if(tokenChangeTimeout) {
                    clearTimeout(tokenChangeTimeout);
                }
                tokenChangeTimeout = setTimeout(authenticationChanged, 100);
            });
            // Listen for Beta toggle
            document.getElementById("input-bookalope-beta").addEventListener("change", () => {
                authenticationChanged();
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

            // Register the handler that closes the Picker(s) when clicking outside
            document.addEventListener("click", function (event) {
                if (!isAncestorOf(event.target, ".dropdown-select")) {
                    closeAllDropdowns();
                }
            });

            // Add picker parent structure to each select
            // Does not populate the picker menu
            buildPickers();

            // And we're ready.
            showStatusOk();

            // On valid token, attempt to retrieve server UI data
            authenticationChanged();

            // Switch to the correct panel depending on the currently active document.
            switchPanel();
        }
    });

    // Load all SVG icons used by the extension so that they become available to the <svg> elements.
    loadIcons("images/spectrum-icons.svg");
}());