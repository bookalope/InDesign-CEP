/*jslint browser: true, devel: true */
/*global window, document, navigator, atob */

/**
 * Alright this is a funky Adobe Spectrum thing. Looking at the documentation for Picker
 * elements:
 *
 *   https://opensource.adobe.com/spectrum-css/picker.html
 *   https://spectrum.adobe.com/page/picker/
 *
 * then Spectrum switches a <select> element to `hidden` and instead uses its own implementation;
 * however, it's required to keep the <select> element and to sync its <option> values with the
 * Spectrum Picker to make sure that forms continue to work. A bit spunky, but that's how they do
 * it, I guess 😳
 */

function refreshSpectrumDropdowns() {

    /**
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
        var parent = element.parentNode;
        while (parent && parent.nodeType && parent.nodeType === 1) {
            if (parent.matches(selector)) {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
    }

    /**
     * Close the given Dropdown's popover element.
     */

    function closeDropdown(dropdown) {
        dropdown.classList.remove("is-open");
        dropdown.classList.remove("is-dropup");
        var dropdownPopover = dropdown.querySelector(".dropdown-select__popover");
        if (dropdownPopover !== null) {
            // This should always exist, no?
            dropdownPopover.classList.remove("is-open");
            dropdown.classList.remove("spectrum-Popover--top");
            dropdown.classList.add("spectrum-Popover--bottom");
        }
    }

    /**
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

    // Here it goes. Iterate over all <select> elements in the documents (assuming
    // that they have a class 'spectrum-Picker-select') and hide them; then
    // create the Adobe Spectrum specific Dropdowns in their stead.
    document.querySelectorAll(".spectrum-Picker-select").forEach(function (select) {

        /**
         * Change the current label of a Dropdown.
         */

        function changeDropdownLabel(newValue, newLabel, isPlaceholder) {
            dropdownLabel.textContent = newLabel;
            dropdownLabel.dataset.value = newValue;
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
            var isPlaceholderValue = false;
            dropdownItems.forEach(function (dropdownItem) {
                if (dropdownItem.dataset.value === newValue) {
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
            var changeEvent = new CustomEvent("change");
            select.dispatchEvent(changeEvent);
        }

        // Get the <select> element's options; its "placeholder" (which is the label shown
        // when no option is selected); and its id attribute.
        var selectOptions = select.children,
            selectPlaceholder = select.dataset.placeholder,
            selectId = select.getAttribute("id");

        // Hide the original <select> element, but we need to keep it in the DOM to ensure
        // that its value is used by the outer form.
        select.classList.add("hidden");

        // Given the <select> element, check if the next sibling is a Spectrum Picker that
        // has been inserted previously. If that is the case, then remove it now before
        // building a new and updated Spectrum Dropdown from the <select> element's options.
        var nextSibling = select.nextElementSibling;
        if (nextSibling) {
            if (nextSibling.tagName === "DIV" && nextSibling.classList.contains("dropdown-select") && nextSibling.dataset.id === selectId) {
                nextSibling.remove();
            }
        }

        // Build the fancy-schmancy Spectrum Dropdown as an HTML string. For more details
        // on how this works, take a look at the docs:
        //   http://opensource.adobe.com/spectrum-css/2.13.0/docs/#dropdown
        // When done, add the HTML into the DOM right after the original <select> element.
        var dropdownHTML = "";
        dropdownHTML += "<div class='dropdown-select' data-id='" + selectId + "'>";
        dropdownHTML += "<button class='spectrum-Picker spectrum-Picker--sizeM dropdown-select__trigger'>" +
            "<span class='spectrum-Picker-label dropdown-select__label is-placeholder'>" + selectPlaceholder + "</span>" +
            "<svg class='spectrum-Icon spectrum-Icon--sizeM spectrum-Picker-validationIcon' focusable='false' aria-hidden='true' aria-label='Alert'><use xlink:href='#spectrum-icon-18-Alert'></use></svg>" +
            "<svg class='spectrum-Icon spectrum-UIIcon-ChevronDown100 spectrum-Picker-menuIcon dropdown-select__icon' focusable='false' aria-hidden='true'><use xlink:href='#spectrum-css-icon-Chevron100'/></svg>" +
            "</button>";
        dropdownHTML += "<div class='spectrum-Popover spectrum-Popover--bottom spectrum-Picker-popover dropdown-select__popover'>" +
            "<ul class='spectrum-Menu' role='listbox'>";
        Array.from(selectOptions).forEach(function (option) {
            var isPlaceholder = option.dataset.placeholder === "true",
                isDivider = option.dataset.divider === "true";
            var cssItemClasses = "";
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
            var optionText = option.textContent,
                optionValue = option.getAttribute("value");
            dropdownHTML += "<li class='" + cssItemClasses + "' data-value='" + optionValue + "' " +
                "role='" + (isDivider ? "separator" : "option") + "'>";
            if (!isDivider) {
                dropdownHTML += "<span class='spectrum-Menu-itemLabel'>" + optionText + "</span>";
                dropdownHTML += "<svg class='spectrum-Icon spectrum-UIIcon-Checkmark100 spectrum-Menu-checkmark spectrum-Menu-itemIcon' focusable='false' aria-hidden='true'><use xlink:href='#spectrum-css-icon-Checkmark100'></use></svg>";
            }
            dropdownHTML += "</li>";
        });
        dropdownHTML += "</ul></div></div>";
        select.insertAdjacentHTML("afterend", dropdownHTML);

        // Now that the Dropdown is inserted into the DOM, attach the required event handlers
        // so that it behaves like a proper replacement for the <select> element.
        var dropdown = document.querySelector(".dropdown-select[data-id='" + selectId + "']");
        var dropdownPopover = dropdown.querySelector(".dropdown-select__popover"),
            dropdownItems = dropdown.querySelectorAll(".spectrum-Menu-item"),
            dropdownLabel = dropdown.querySelector(".dropdown-select__label"),
            dropdownTrigger = dropdown.querySelector(".dropdown-select__trigger");

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
                var newValue = this.dataset.value,
                    newLabel = this.textContent;
                changeSelectValue(newValue, newLabel);
            });

            // If the menu item is the selected one, then update the Dropdown's label.
            var value = dropdownItem.dataset.value;
            if (value === select.value) {
                changeDropdownLabel(value, dropdownItem.textContent,
                    dropdownItem.classList.contains("is-placeholder"));
            }
        });

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
                        var elementStyle = window.getComputedStyle(element);
                        if (elementStyle.display !== "none") {
                            var maxHeight = elementStyle.maxHeight.replace("px", "").replace("%", "");
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

                        var height = element.offsetHeight;

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
                    var panel = dropdown.closest(".panel__body");  // Or use <body>.
                    var dropdownPopover = dropdown.querySelector(".dropdown-select__popover");

                    // Check whether there is enough room below the Dropdown to open the
                    // popover below; if there is not, then open the popover above the Dropdown.
                    // TODO The popover is always not displayed yet, simplify getHeight() function!
                    var popoverHeight = getHeight(dropdownPopover);
                    if (dropdown.parentNode.offsetTop > popoverHeight) {
                        var top = dropdown.parentNode.offsetTop + dropdown.offsetHeight + popoverHeight;
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

    // Clicking outside of the Dropdown or its popover closes any open popover.
    document.addEventListener("click", function (event) {
        if (!isAncestorOf(event.target, ".dropdown-select")) {
            closeAllDropdowns();
        }
    });
}
