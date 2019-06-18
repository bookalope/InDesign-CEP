/*jslint browser: true, devel: true */
/*global window, atob, btoa */
/*global Promise, Blob */
/*global BookalopeClient, Book, Bookflow */


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

    return missing;
}


/**
 * Retrieve the user's Bookalope API token that's stored by Chromium, or return undefined
 * if the token wasn't found.
 *
 * See also: https://developer.mozilla.org/en/docs/Web/API/Window/localStorage
 *
 * @returns {string | undefined} The user's Bookalope API token.
 */

function getBookalopeAPIToken() {
    var token = undefined;
    if (typeof localStorage === "object") {
        token = localStorage.getItem("idsn_extension_bookalope_api_token");
    }
    return token;
}


/**
 * Store the given Bookalope API token for later use. Makes it easier for the user so she
 * doesn't have to keep entering the token between sessions.
 *
 * See also: https://developer.mozilla.org/en/docs/Web/API/Window/localStorage
 *
 * @param {string} token - A valid Bookalope token.
 */

function setBookalopeAPIToken(token) {
    if (typeof localStorage === "object") {
        localStorage.setItem("idsn_extension_bookalope_api_token", token);
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
    document.getElementById("input-bookalope-beta").checked = false;
    document.getElementById("input-file").value = "";
    document.getElementById("input-book-name").value = "";
    document.getElementById("input-book-author").value = "";
    document.getElementById("input-book-language").value = "";
    document.getElementById("input-book-copyright").value = "";
    document.getElementById("input-book-pubdate").valueAsDate = new Date();
    document.getElementById("input-book-isbn").value = "";
    document.getElementById("input-book-publisher").value = "";
    document.getElementById("input-book-version").checked = false;
    document.getElementById("input-book-autoclean").checked = true;
    document.getElementById("input-book-highlight-issues").checked = false;

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
    if (element.classList.contains('spectrum-Dropdown-input') === true || element.classList.contains('spectrum-Dropdown-select') === true) {
        var controlDropdown = element.classList.contains('spectrum-Dropdown-input') === true ? element.closest('.spectrum-Dropdown') : element.nextSibling;
        if (controlDropdown !== null) {
            controlDropdown.classList.add("is-invalid");
            controlDropdown.querySelector('.spectrum-Dropdown-trigger').classList.add("is-invalid");
        }
    }
    else if (element.classList.contains('spectrum-Checkbox-input') === true) {
        var controlCheckbox = element.closest('.spectrum-Checkbox');
        if (controlCheckbox !== null) {
            controlCheckbox.classList.add("is-invalid");
        }
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
    showStatus("Ok (v1.0.0)");
}


/**
 * Removes all (if any) element error highlights from the panel, and then shows
 * the generic Ok status message.
 */

function clearErrors() {
    // Grumble. No .forEach() for HTMLCollections, but instead we need to iterate the olden ways.
    // https://stackoverflow.com/questions/22754315/for-loop-for-htmlcollection-elements#22754453
    var elements = document.getElementsByClassName("is-invalid");
    for (var count = 0; count < elements.length; count += 1) {
        elements[count].classList.remove("is-invalid");
    }
    showStatusOk();
}


/**
 * Given a Bookalope Bookflow object, converts the book into the given file format
 * and saves the converted file. Returns a Promise that is fulfilled with the document's
 * filename or rejected with an error string.
 *
 * @param {Bookflow} bookflow - A valid Bookflow object referencing a server-side document conversion.
 * @param {string} format - Convert the given document to this format.
 * @param {string} filename - The file name to save the converted file.
 * @returns {Promise}
 */

function saveBookflowFile(bookflow, format, style, version, filename) {

    // Create and return a new Promise.
    return new Promise(function (resolve, reject) {

        // Call the Bookflow's convert function, which itself returns a Promise. The returned
        // Promise is fulfilled with the Booklow ready for waiting, or rejected with a BookalopeError.
        bookflow.convert(format, style, version)
        .then(function (bookflow) {

            // Conversion is triggered on the server, now check periodically the status of the
            // conversion until it has succeeded or failed.
            var intervalID = setInterval(function (bookflow) {
                bookflow.convert_status(format, style, version)
                .then(function (status_) {

                    // Conversion succeeded, now download and save the converted file.
                    if (status_ === "ok") {
                        clearInterval(intervalID);
                        bookflow.convert_download(format, style, version)
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
                    } else if (status_ === "failed" || status_ === "na") {
                        clearInterval(intervalID);
                        reject(new BookalopeError("Failed to convert document to " + format + "/" + style + "(" + version + ")"));
                    } else {
                        // Do nothing and keep waiting.
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
 */

function askSaveBookflowFile(bookflow, format, style, version) {
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
        saveBookflowFile(bookflow, format, style, version, result.data)
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


    /**
     * Helper function which returns an existing BookalopeClient object, or creates
     * a new one.
     *
     * @returns {BookalopeClient}
     */

    function getBookalope() {
        if (bookalope === undefined) {
            bookalope = new BookalopeClient(bookalopeToken);
        }
        bookalope.setToken(bookalopeToken);
        bookalope.setHost(bookalopeBetaHost);
        return bookalope;
        // bookalope || bookalope = new BookalopeClient(bookalopeToken)
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


        // Bind click handler functions to the links. Because we're using anonymous
        // handler functions here, we can't remove them easily and have to jump through
        // odd hoops (see helper function).
        addClickListener(document.getElementById("a-bookalope"), function () {
            var url = bookflow.getWebURL();
            var result = window.cep.util.openURLInDefaultBrowser(url);
            if (result.err) {
                showClientError("Failed to open web browser (" + result.err + ")");
            }
            return false;
        });

        addClickListener(document.getElementById("button-download"), function () {
            var bookDownload = document.getElementById("input-book-download").value;
            askSaveBookflowFile(bookflow, bookDownload, "default", "test");
            return false;
        });

        addClickListener(document.getElementById("button-refresh"), function () {
            convert(bookflow);
            return false;
        });

    }


    /**
     * Given the Bookflow, convert and download an ICML file and write that file to the
     * local file system as a temporary file. Then invoke the InDesign side to create and
     * layout a new document and place the ICML file into that document. When that returns,
     * delete the ICML file.
     *
     * @param {Bookflow} bookflow - The Bookflow.
     */

    function convert(bookflow) {
        showStatus("Converting and downloading file");

        // Produce a random file name to unique the ICML file.
        // TODO Consider using SHA(apiKey + time + rnd) for a unique identifier.
        var time = Date.now();
        var rnd = Math.random();
        var fname = "idsn-" + time.toString(16).slice(-8) + "-" + rnd.toString(16).slice(-8);

        // Convert the given Bookflow's document to ICML, and save it as a temporary file.
        saveBookflowFile(bookflow, "icml", "default", "test", config.tmp + "/" + fname + ".icml")
        .then(function (filename) {
            showStatus("Building InDesign document");

            // Create the new document on the InDesign side, and pass the Book and Bookflow
            // IDs along to store them with the document. That way, we can update the panel
            // based on the currently active InDesign document.
            var script = "bookalopeCreateDocument('" + filename + "', '" + bookflow.book.id + "', '" + bookflow.id + "');";
            csInterface.evalScript(script, function (result) {
                // TODO handle result = 'EvalScript error'

                // Delete the temporary ICML file.
                var result = window.cep.fs.deleteFile(filename);
                if (result.err) {
                    // TODO Handle error here: let the temporary ICML file leak quietly? Yup.
                }

                // Update links to Bookalope and then switch from the Upload panel to
                // to the Update panel view.
                setBookalopeLinks(bookflow);
                showUpdate();
                showStatusOk();
                hideSpinner();
            });
        })
        .catch(function (error) {
            showServerError(error);
            hideSpinner();
        });
    }


    /**
     * Given the Bookflow, read and upload the document file and some additional Bookflow
     * information to Bookalope. Uploading will trigger the analysis and content extraction.
     * Then wait until the Bookflow step changes from 'processing' to 'convert' which indicates
     * successful analysis; 'processing-failed' would indicate that the analysis failed. Once
     * the analysis succeeded, continue to convert and download the ICML for this document.
     *
     * @param {Bookflow} bookflow - The Bookflow.
     *
     */

    function uploadFile(bookflow) {
        showStatus("Uploading and analyzing document");

        // Read the user selected file.
        var result = window.cep.fs.readFile(bookFile.path, window.cep.encoding.Base64);
        if (result.err) {
            showElementError(document.getElementById("input-file"), "Unable to load file (" + result.err + ")");
            hideSpinner();
        } else {

            // Note that result.data is a base-64 encoded binary, so we have to decode it
            // before passing it to the Bookalope wrapper. The wrapper will then encode
            // it (again) before shipping it off to the server.
            bookflow.setDocument(bookFile.name, atob(result.data))
            .then(function (bookflow) {

                // Periodically poll the Bookalope server to update the Bookflow. Then check
                // the step property for the current processing status of the Bookalope, and
                // act accordingly.
                var intervalID = setInterval(function (bookflow) {
                    bookflow.update()
                    .then(function (bookflow) {
                        if (bookflow.step === "processing") {
                            // Bookalope is still processing, keep waiting.
                        } else if (bookflow.step === "processing_failed") {
                            clearInterval(intervalID);
                            showServerError("Bookalope failed to process the document");
                            hideSpinner();
                        } else if (bookflow.step === "convert") {
                            clearInterval(intervalID);
                            convert(bookflow);
                        }
                    })
                    .catch(function (error) {
                        clearInterval(intervalID);
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
        showSpinner();
        showStatus("Creating Book and Bookflow");

        // Get the BookalopeClient object.
        var bookalope = getBookalope();


        // Create a new Book, which then contains an empty Bookflow. That is the
        // Bookfow we'll work with. Note that the user will see both Book and Bookflow
        // when she logs into the website.
        bookalope.createBook(bookName)
        .then(function (book) {
            var bookflow = book.bookflows[0];
            uploadFile(bookflow);
        })
        .catch(function (error) {
            showServerError(error.message);
            hideSpinner();
        });
    }


    /**
     * When the user clicks the "Upload and Convert", then we create a new Book and Bookflow
     * for the given document, upload the given file, and when converted, download the ICML
     * and place it into a new InDesign document. All that is being kicked off by this handler
     * function.
     */

    function uploadAndConvertDocument() {

        // Store the API authentication key to local storage for later.
        bookalopeToken = document.getElementById("input-bookalope-token").value.toLowerCase();
        setBookalopeAPIToken(bookalopeToken);

        bookalopeBetaHost = document.getElementById("input-bookalope-beta").checked;

        // Get the values from the form fields.
        bookFile = document.getElementById("input-file").files[0];
        bookName = document.getElementById("input-book-name").value;
        bookAuthor = document.getElementById("input-book-author").value;
        bookCopyright = document.getElementById("input-book-copyright").value;
        bookLanguage = document.getElementById("input-book-language").value;
        bookPubDate = document.getElementById("input-book-pubdate").value;
        bookIsbn = document.getElementById("input-book-isbn").value;
        bookPublisher = document.getElementById("input-book-publisher").value;
        bookVersion = document.getElementById("input-book-version").checked;
        bookAutoClean = document.getElementById("input-book-autoclean").checked;
        bookHighlightIssues = document.getElementById("input-book-highlight-issues").checked;

        // Hide error messages and clear out highlighted fields, if there are any.
        clearErrors();
        // Check for errors of the input fields. If everything is good then
        // upload the document to Bookalope for conversion.
        if (!(/^[0-9a-fA-F]{32}$/).test(bookalopeToken)) {
            showElementError(document.getElementById("input-bookalope-token"), "Field is required");
            document.getElementById("input-bookalope-token").scrollIntoView(false);
        }
        else if (bookFile === undefined) {
            showElementError(document.getElementById("input-file"), "Field is required");
            document.getElementById("input-book-name").scrollIntoView(false);
        }
        else if (bookFile.size > 268435456) { // 256MiB
            showElementError(document.getElementById("input-file"), "File size exceeded 12Mb");
            document.getElementById("input-book-name").scrollIntoView(false);
        }
        else if (bookName.length === 0) {
            showElementError(document.getElementById("input-book-name"), "Field is required");
            document.getElementById("input-book-name").scrollIntoView(false);
        }
        else {
            // No errors, proceed.
            createBook();
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

            // The result is either an empty string or a JSON string that contains
            // a dictionary with the bookflow id. If InDesign switches to a document
            // with a bookflow id, then show the Update panel; else show the Upload
            // panel from which we create a new document.
            var bookalopeDocData = JSON.parse(result);
            if (bookalopeDocData) {

                // Get Book and Bookflow IDs.
                var bookId = bookalopeDocData["book-id"];
                var bookflowId = bookalopeDocData["bookflow-id"];
                // TODO Paranoid: (/^[0-9a-fA-F]{32}$/).test(bookId), (/^[0-9a-fA-F]{32}$/).test(bookflowId)

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

        // Based on the theme's name switch the CSS files accordingly.
        var hostThemeEl = document.getElementById("hostTheme");
        var hostEl = document.querySelector("body");
        var curTheme = hostThemeEl.getAttribute("data-theme");
        if (theme !== curTheme) {
            hostThemeEl.setAttribute("data-theme", theme);
            hostThemeEl.setAttribute("href", "css/spectrum/spectrum-" + theme + ".css");
            hostEl.classList.remove("spectrum--" + curTheme);
            hostEl.classList.add("spectrum--" + theme);
        }
    }


    // First things first: get some configuration information from the InDesign side.
    var config;
    var csInterface = new CSInterface();

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
        // then show the appropriate panel.
        var missingFeatures = detectFeatures();
        if (missingFeatures.length) {

            // Build a somewhat verbose error message.
            var message = "Insufficient feature set<br><br>";
            message += "User agent: " + navigator.userAgent + "<br><br>";
            message += "InDesign: " + config.app.version + "<br><br>";
            message += "Unsupported features: " + missingFeatures.join(", ");
            showClientError(message);

        } else {

            // Get the Bookalope API token if it's been stored before, and make it the value
            // of the token input field.
            bookalopeToken = getBookalopeAPIToken();
            if (bookalopeToken !== undefined) {
                document.getElementById("input-bookalope-token").value = bookalopeToken;
            }

            // Add a few relevant event handlers to catch changes.
            csInterface.addEventListener("documentAfterActivate", function (csEvent) {
                switchPanel();
            });

            // Register the callback for the Convert button.
            document.getElementById("button-send").addEventListener("click", function () {
                uploadAndConvertDocument();
            });

            // And we're ready.
            showStatusOk();

            // Switch to the correct panel depending on the currently active document.
            switchPanel();
        }
    });

}());
