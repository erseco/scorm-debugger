
(function() {
    // Elements table.
    var elementsTable;

    // SCORM API object (using our local simulated API).
    var API = window.API;

    // Log dialog reference.
    var logDialog;

    // Current loaded SCOs
    var currentScos = [];

    function initAPI() {
        // Use the local SCORM API simulation
        API = window.API;
        if (!API) {
            console.error('SCORM API not found');
            return;
        }

        // Register callback for data changes (to update debugger in real-time)
        API.onChange(function(element, value, operation) {
            if (operation === 'set' && element) {
                updateTableRow(element, value);
            }
            if (operation === 'initialize') {
                updateApiStatus(true);
                // Reload the elements table
                if (elementsTable) {
                    elementsTable.clear();
                    loadReadElements();
                }
            }
            if (operation === 'finish') {
                updateApiStatus(false);
            }
            if (operation === 'reset') {
                updateApiStatus(false);
                if (elementsTable) {
                    elementsTable.clear().draw();
                }
            }
            // Log the operation
            if (operation !== 'get') {
                log(operation.toUpperCase() + (element ? ': ' + element + ' = ' + value : ''), '0');
            }
        });
    }

    function updateApiStatus(initialized) {
        var statusEl = $('#api-status');
        if (initialized) {
            statusEl.removeClass('status-not-initialized').addClass('status-initialized').text('Initialized');
        } else {
            statusEl.removeClass('status-initialized').addClass('status-not-initialized').text('Not initialized');
        }
    }

    function updateTableRow(element, value) {
        if (!elementsTable) return;

        // Find if row exists
        var found = false;
        elementsTable.rows().every(function() {
            var data = this.data();
            if (data[0] === element) {
                // Update the row
                var description = '';
                if (typeof dataModelDescription !== 'undefined' && dataModelDescription[element]) {
                    description = dataModelDescription[element].description;
                }
                this.data([element, value, description]).draw(false);
                found = true;
                return false; // break
            }
        });

        // If not found, add new row
        if (!found) {
            var description = '';
            var normalizedElement = element.replace(/\.\d+\./g, '.n.');
            if (typeof dataModelDescription !== 'undefined' && dataModelDescription[normalizedElement]) {
                description = dataModelDescription[normalizedElement].description;
            }
            elementsTable.row.add([element, value, description]).draw(false);
        }
    }

    // Load elements for auto-completion.
    var availableElements = [];
    if (typeof dataModel !== 'undefined') {
        $.each(dataModel, function(element, properties) {
            availableElements.push(element);
        });
    }

    /**
     * Load the remote (only read) element values
     */
    function loadReadElements() {
        if (!API || !API.isInitialized()) {
            return;
        }

        var value, description;
        $.each(dataModel, function(element, properties) {
            if (element.indexOf('.n.') === -1 && (properties.mod == 'rw' || properties.mod == 'r')) {
                if (typeof dataModelDescription[element] != 'undefined') {
                    description = dataModelDescription[element].description;
                } else {
                    description = '';
                }
                value = getElement(element, true); // silent mode
                if (typeof value == "string") {
                    value = value.replace(/,/g, ", ");
                }

                elementsTable.row.add([element, value, description]).draw(false);
            }
        });

        // Load objectives if any
        var objectivesCount = getElement("cmi.objectives._count", true);
        if (objectivesCount > 0) {
            for (var i = 0; i < objectivesCount; i++) {
                var objEl = ["id", "score.raw", "score.min", "score.max", "status"];
                objEl.forEach(function(child) {
                    var element = "cmi.objectives." + i + "." + child;
                    value = getElement(element, true);
                    if (typeof value == "string") {
                        value = value.replace(/,/g, ", ");
                    }
                    elementsTable.row.add([element, value, ""]).draw(false);
                });
            }
        }

        elementsTable.draw();
    }

    function displayElementInfo(element) {
        // Normalize element (replace .X. elements with .n. ones).
        element = element.replace(/.\d+./,".n.");
        $("#debugger-element-description").html('');
        if (typeof dataModel !== 'undefined' && typeof dataModel[element] != 'undefined') {
            var info = "<p><strong>Element information</strong></p>";
            if (typeof dataModelDescription[element] != 'undefined') {
                info += "<p>Data type: " + dataModelDescription[element].datatype + "</p>";
                info += "<p>Permissions: " + dataModelDescription[element].permissions + "</p>";
                info += "<p>Description: " + dataModelDescription[element].description + "</p>";
                $("#debugger-element-description").html(info);
            }
        }
    }

    function log(data, error) {
        var timeNow = new Date().toLocaleTimeString();
        // Error information.
        var errorString = "";
        if (error != "0" && API) {
            errorString = " ERROR: " + API.LMSGetErrorString(error);
        }
        $("#log").prepend("<p>" + timeNow + ": " + data + errorString + "</p>");
    }

    /**
     * Get an element from the LMS
     * @param  {string} element element name
     * @param  {boolean} silent if true, don't log
     * @return {string}         element value
     */
    function getElement(element, silent) {
        if (!API) return '';
        var result = API.LMSGetValue(element);
        var error = API.LMSGetLastError();
        if (!silent) {
            log("Get element: " + element + " returned value was: " + result, error);
        }
        return result;
    }

    /**
     * Save element in the LMS (not commiting the results)
     * @param  {string} element element name
     * @param  {string} value   element value
     * @return {string}         result
     */
    function setElement(element, value) {
        if (!API) return 'false';
        var result = API.LMSSetValue(element, value);
        var error = API.LMSGetLastError();
        log("Save element:" + element + " with value: " + value, error);
        return result;
    }

    function commitValues() {
        if (!API) return;
        var result = API.LMSCommit("");
        var error = API.LMSGetLastError();
        log("LMSCommit called, returned: " + result, error);
        return;
    }

    function randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    }

    function randomString() {
        return (Math.random() + 1).toString(36).substring(10);
    }

    function checkExpectedValues(output, values) {
        var value, error;

        for (var el in values) {
            value = API.LMSGetValue(el);
            error = API.LMSGetLastError();
            if (error != '0') {
                output.append('<p style="color: red">Error getting: ' + el +' with value ' + values[el] + '. ' + API.LMSGetErrorString(error) + '</p>');
            }
            if (value !== API.LMSGetValue(el)) {
                output.append('<p style="color: red">Error getting: ' + el +' expected value was' + values[el] + ', returned is: ' + value + '</p>');
            }
        }
    }

    function launchTests() {
        if (!API || !API.isInitialized()) {
            alert('Please launch a SCO first to initialize the API');
            return;
        }

        var output = $('#tests-output');
        output.empty();

        var interactionsCount = parseInt(API.LMSGetValue('cmi.interactions._count'));
        var objectivesCount = parseInt(API.LMSGetValue('cmi.objectives._count'));

        if (interactionsCount > 0) {
            output.append('<p>Interactions tests may fail, you already have ' + interactionsCount + ' stored in the LMS</p>');
        }
        if (objectivesCount > 0) {
            output.append('<p>Objectives tests may fail, you already have ' + objectivesCount + ' stored in the LMS</p>');
        }

        // Get last error.
        if (API.LMSGetLastError() == '0') {
            output.append('<p>Last error OK</p>');
        }
        // Set some values.
        var statuses = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
        var values = {
            'cmi.core.lesson_location': randomString(),
            'cmi.core.lesson_status': statuses[randomNumber(0, 5)],
            'cmi.core.score.raw': randomNumber(1, 10),
            'cmi.core.score.min': 0,
            'cmi.core.score.max': 10,
            'cmi.suspend_data': randomString(),
            'cmi.comments': randomString(),
            'cmi.student_preference.audio': randomNumber(1, 10),
            'cmi.student_preference.language': 'en',
            'cmi.student_preference.speed': randomNumber(1, 10),
            'cmi.student_preference.text': randomNumber(0, 1)
        };
        var value, error;

        for (var el in values) {
            API.LMSSetValue(el, values[el]);
            error = API.LMSGetLastError();

            if (error != '0') {
                output.append('<p style="color: red">Error setting: ' + el +' with value ' + values[el] + '. ' + API.LMSGetErrorString(error) + '</p>');
            }
        }
        output.append('<p>All values set</p>');

        // Get the values (and check everything is correct).
        checkExpectedValues(output, values);
        output.append('<p>All values retrieved</p>');

        // Commit the changes.
        API.LMSCommit("");
        error = API.LMSGetLastError();
        if (error != '0') {
            output.append('<p style="color: red">Error calling LMSCommit. ' + API.LMSGetErrorString(error) + '</p>');
        }
        output.append('<p>Values commited</p>');

        // Get again after commiting the changes.
        checkExpectedValues(output, values);
        output.append('<p>All values retrieved</p>');

        // Create some objectives.
        var objectivesCount = randomNumber(4, 10);
        var objectivesIds = {};

        values = {};
        for (var i=0; i<objectivesCount; i++) {
            values['cmi.objectives.' + i + '.id'] = randomString();
            objectivesIds[i] = values['cmi.objectives.' + i + '.id'];
            values['cmi.objectives.' + i + '.score.raw'] = randomNumber(1, 10);
            values['cmi.objectives.' + i + '.score.min'] = 0;
            values['cmi.objectives.' + i + '.score.max'] = 10;
            values['cmi.objectives.' + i + '.status'] = statuses[randomNumber(0, 5)];
        }

        for (el in values) {
            API.LMSSetValue(el, values[el]);
            error = API.LMSGetLastError();

            if (error != '0') {
                output.append('<p style="color: red">Error setting: ' + el +' with value ' + values[el] + '. ' + API.LMSGetErrorString(error) + '</p>');
            }
        }

        // Test the number of objectives created is correct.
        var lmsCount = API.LMSGetValue('cmi.objectives._count');
        if (lmsCount !== objectivesCount) {
            output.append('<p style="color: red">Expecting ' + objectivesCount+ ' objectives found ' + lmsCount + '</p>');
        } else {
            output.append('<p>Objectives count correct: ' + objectivesCount + '</p>');
        }

        // Check retrieved values.
        checkExpectedValues(output, values);
        output.append('<p>All objectives retrieved</p>');

        // Create some interactions.
        var interactionsCount = randomNumber(4, 10);
        var interactionsObjectivesCount = {};

        values = {};
        var types = ['true-false', 'choice', 'fill-in', 'matching', 'performance', 'sequencing', 'likert', 'numeric'];
        var results = ['correct', 'wrong', 'unanticipated', 'neutral'];
        for (var i=0; i<interactionsCount; i++) {
            values['cmi.interactions.' + i + '.id'] = randomString();
            values['cmi.interactions.' + i + '.time'] = randomNumber(10, 20) + ':' + randomNumber(10, 59) + ':' + randomNumber(10, 59);
            values['cmi.interactions.' + i + '.type'] = types[randomNumber(0, 7)];
            values['cmi.interactions.' + i + '.weighting'] = randomNumber(0, 1);
            values['cmi.interactions.' + i + '.student_response'] = randomNumber(0, 5);
            values['cmi.interactions.' + i + '.result'] = results[randomNumber(0, 3)];
            values['cmi.interactions.' + i + '.latency'] = randomNumber(10, 20) + ':' + randomNumber(10, 59) + ':' + randomNumber(10, 59);

            var tmpCount = randomNumber(0, objectivesCount);
            interactionsObjectivesCount[i] = tmpCount;
            for (var j=0; j < tmpCount; j++) {
                values['cmi.interactions.' + i + '.objectives.' + j + '.id'] = objectivesIds[j];
                values['cmi.interactions.' + i + '.correct_responses.' + j + '.pattern'] = randomString();
            }

        }

        for (el in values) {
            API.LMSSetValue(el, values[el]);
            error = API.LMSGetLastError();

            if (error != '0') {
                output.append('<p style="color: red">Error setting: ' + el +' with value ' + values[el] + '. ' + API.LMSGetErrorString(error) + '</p>');
            }
        }

        // Test the number of interactions created is correct.
        var lmsCount = API.LMSGetValue('cmi.interactions._count');
        if (lmsCount !== interactionsCount) {
            output.append('<p style="color: red">Expecting ' + interactionsCount+ ' interactions found ' + lmsCount + '</p>');
        } else {
            output.append('<p>Interactions count correct: ' + interactionsCount + '</p>');
        }

        for (i=0; i < interactionsCount; i++) {
            var lmsCount = API.LMSGetValue('cmi.interactions.'+i+'.objectives._count');
            if (lmsCount !== interactionsObjectivesCount[i]) {
                output.append('<p style="color: red">Expecting ' + interactionsObjectivesCount[i] + ' objectives in the interaction found ' + lmsCount + '</p>');
            } else {
                output.append('<p>Interaction objectives count correct: ' + interactionsObjectivesCount[i] + '</p>');
            }

            lmsCount = API.LMSGetValue('cmi.interactions.'+i+'.correct_responses._count');
            if (lmsCount !== interactionsObjectivesCount[i]) {
                output.append('<p style="color: red">Expecting ' + interactionsObjectivesCount[i] + ' correct responses in the interaction found ' + lmsCount + '</p>');
            } else {
                output.append('<p>Interaction correct responses count correct: ' + interactionsObjectivesCount[i] + '</p>');
            }
        }

    }

    // ==========================================
    // ZIP Loading and SCO Launching Functions
    // ==========================================

    function showLoadZone() {
        $('#load-zone').show();
        $('#main-container').hide();
        $('#load-error').text('');
        $('#load-progress').text('');
    }

    function showMainContainer() {
        $('#load-zone').hide();
        $('#main-container').show();
    }

    function handleFileSelect(file) {
        if (!file) return;

        $('#load-error').text('');
        $('#load-progress').text('Loading package...');

        ZipLoader.loadZip(file).then(function(result) {
            $('#load-progress').text('');

            // Update package name
            $('#package-name').text(result.packageName);

            // Populate SCO selector
            var selector = $('#sco-selector');
            selector.empty();
            selector.append('<option value="">-- Select SCO --</option>');

            currentScos = result.scos;
            result.scos.forEach(function(sco, index) {
                var title = sco.title || sco.identifier || ('SCO ' + (index + 1));
                selector.append('<option value="' + index + '">' + title + '</option>');
            });

            // Enable launch button when SCO is selected
            selector.off('change').on('change', function() {
                var selected = $(this).val();
                $('#launch-btn').prop('disabled', selected === '');
            });

            // Show main container
            showMainContainer();

            log('Package loaded: ' + result.packageName + ' (' + result.scos.length + ' SCOs found)', '0');

        }).catch(function(error) {
            $('#load-progress').text('');
            $('#load-error').text('Error: ' + error.message);
            console.error('Error loading package:', error);
        });
    }

    // Global function to handle page navigation from within the SCO
    window._scormLoadPage = function(href) {
        console.log('[Debugger] Navigation request:', href);
        ZipLoader.navigateToPage(href).then(function(htmlContent) {
            var iframe = document.getElementById('sco-frame');
            iframe.srcdoc = htmlContent;
            log('Navigated to: ' + href, '0');
        }).catch(function(error) {
            console.error('Navigation error:', error);
            alert('Could not navigate to: ' + href);
        });
    };

    function launchSCO() {
        var scoIndex = $('#sco-selector').val();
        if (scoIndex === '' || !currentScos[scoIndex]) {
            alert('Please select a SCO first');
            return;
        }

        var sco = currentScos[scoIndex];

        // Reset API state
        API.reset();

        // Show iframe, hide placeholder
        $('#content-placeholder').hide();
        $('#sco-frame').show();

        // Get SCO content and load it using srcdoc for same-origin access
        ZipLoader.getScoContent(sco).then(function(htmlContent) {
            var iframe = document.getElementById('sco-frame');

            // Use srcdoc to load content - this inherits the parent's origin
            // so the iframe can access window.parent.API directly
            iframe.srcdoc = htmlContent;

            log('Launching SCO: ' + (sco.title || sco.identifier), '0');

        }).catch(function(error) {
            console.error('Error launching SCO:', error);
            alert('Error launching SCO: ' + error.message);
        });
    }

    function resetData() {
        if (confirm('Reset all SCORM data? The SCO will need to be relaunched.')) {
            API.reset();
            elementsTable.clear().draw();
            $('#sco-frame').attr('src', 'about:blank').hide();
            $('#content-placeholder').show();
            log('Data reset', '0');
        }
    }

    // ==========================================
    // Resizable panels
    // ==========================================

    function initResizer() {
        var resizer = document.getElementById('resizer');
        var leftPanel = document.getElementById('content-panel');
        var rightPanel = document.getElementById('debugger-panel');

        var startX, startWidthLeft, startWidthRight;

        function startResize(e) {
            startX = e.clientX;
            startWidthLeft = leftPanel.offsetWidth;
            startWidthRight = rightPanel.offsetWidth;
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        }

        function resize(e) {
            var diff = e.clientX - startX;
            var newLeftWidth = startWidthLeft + diff;
            var newRightWidth = startWidthRight - diff;

            // Minimum widths
            if (newLeftWidth > 200 && newRightWidth > 300) {
                leftPanel.style.flex = 'none';
                leftPanel.style.width = newLeftWidth + 'px';
                rightPanel.style.width = newRightWidth + 'px';
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        }

        resizer.addEventListener('mousedown', startResize);
    }

    // ==========================================
    // Set-up everything.
    // ==========================================
    $(document).ready(function(){
        initAPI();

        // Dropzone functionality
        var dropzone = document.getElementById('dropzone');
        var fileInput = document.getElementById('file-input');

        dropzone.addEventListener('click', function() {
            fileInput.click();
        });

        dropzone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        // Toolbar buttons
        $('#launch-btn').on('click', launchSCO);
        $('#reset-btn').on('click', resetData);
        $('#load-another').on('click', function() {
            API.reset();
            ZipLoader.cleanup();
            $('#sco-frame').attr('src', 'about:blank');
            showLoadZone();
        });

        // Initialize resizer
        initResizer();

        // Initialize tabs
        $("#options-tabs").tabs();

        // Initialize log dialog
        logDialog = $("#log-dialog").dialog({
          position: { my: "right bottom", at: "right bottom", of: window },
          height: '300',
          autoOpen: false
        });

        // Initialize DataTable
        elementsTable = $('#elementstable').DataTable({paging: false, searching: true});

        // Reload button
        $("#reload").button({
          icons: {
            primary: "ui-icon-refresh"
          }
        }).on('click', function(e) {
            elementsTable.clear();
            loadReadElements();
        });

        // Log toggle button
        $("#show-log").button({
          icons: {
            primary: "ui-icon-info"
          }
        }).on('click', function(e) {
            if (logDialog.dialog("isOpen")) {
                logDialog.dialog("close");
            } else {
                logDialog.dialog("open");
            }
        });

        // Prepare the debugging tab.
        $("#element").autocomplete({
          source: availableElements
        });
        $("#set-value, #commit-value, #get-value").button({});

        $("#element").on("autocompleteselect", function(event, ui) {
            displayElementInfo($(this).val());
        });

        // Request value dialog.
        var dialog = $("#requestvalue").dialog({
            autoOpen: false,
            height: 200,
            width: 300,
            buttons: {
                "Save": function() {
                    setElement($("#element").val(), $("#element-value").val());
                    dialog.dialog( "close" );
                },
                Cancel: function() {
                    dialog.dialog( "close" );
                }
            },
        });

        // Auto submit on enter pressed.
        $("#element-value").keypress(function(e) {
            if(e.which == 13) {
                setElement($("#element").val(), $(this).val());
                dialog.dialog( "close" );
            }
        });

        // Save action
        $("#set-value").on('click', function(e) {
            if (!API || !API.isInitialized()) {
                alert('Please launch a SCO first to initialize the API');
                return;
            }
            dialog.dialog("open");
        });

        // Commit action
        $("#commit-value, #commit-common, #commit-interactions, #commit-testdata").on('click', function(e) {
            if (!API || !API.isInitialized()) {
                alert('Please launch a SCO first to initialize the API');
                return;
            }
            commitValues();
        });

        $("#get-value").on('click', function(e) {
            if (!API || !API.isInitialized()) {
                alert('Please launch a SCO first to initialize the API');
                return;
            }
            var val = getElement($("#element").val());
            $("#debugger-element-value").html("<strong>Value: </strong>" + val);
        });

        // Common operations.
        $( "#set-lesson-status" ).selectmenu({
            change: function( event, data ) {
                if (!API || !API.isInitialized()) {
                    alert('Please launch a SCO first to initialize the API');
                    return;
                }
                setElement('cmi.core.lesson_status', data.item.value);
            }
        });

        $( "#set-score" ).selectmenu({
            change: function( event, data ) {
                if (!API || !API.isInitialized()) {
                    alert('Please launch a SCO first to initialize the API');
                    return;
                }
                setElement('cmi.core.score.min', 0);
                setElement('cmi.core.score.max', 10);
                setElement('cmi.core.score.raw', data.item.value);
            }
        });

        $( "#set-exit" ).selectmenu({
            change: function( event, data ) {
                if (!API || !API.isInitialized()) {
                    alert('Please launch a SCO first to initialize the API');
                    return;
                }
                setElement('cmi.core.exit', data.item.value);
            }
        });

        $( "#set-nav-event" ).selectmenu({
            change: function( event, data ) {
                if (!API || !API.isInitialized()) {
                    alert('Please launch a SCO first to initialize the API');
                    return;
                }
                if (data.item.value) {
                    setElement('nav.event', data.item.value);
                    API.LMSFinish("");
                }
            }
        });

        // Interactions and objectives.
        var interactionsDialog = $("#new-interaction").dialog({
            autoOpen: false,
            height: 500,
            width: 400,
            buttons: {
                "Save": function() {
                    var prefix = "cmi.interactions." + $("#interaction-number").val() + ".";
                    setElement(prefix + "id", $("#interaction-id").val());
                    setElement(prefix + "time", $("#interaction-time").val());
                    setElement(prefix + "type", $("#interaction-type").val());
                    setElement(prefix + "weighting", $("#interaction-weighting").val());
                    setElement(prefix + "student_response", $("#interaction-student_response").val());
                    setElement(prefix + "result", $("#interaction-result").val());
                    setElement(prefix + "latency", $("#interaction-latency").val());
                    var i = 0;
                    $("#interaction-objectives").val().split(',').forEach(function (objectiveId) {
                        setElement(prefix + "objectives." + i + ".id", $.trim(objectiveId));
                        i++;
                    });
                    i = 0;
                    $("#interaction-correct-responses").val().split(',').forEach(function (pattern) {
                        setElement(prefix + "correct_responses." + i + ".pattern", $.trim(pattern));
                        i++;
                    });
                    interactionsDialog.dialog( "close" );
                },
                Cancel: function() {
                    interactionsDialog.dialog( "close" );
                }
            },
        });

        $("#create-interactions").on('click', function(e) {
            if (!API || !API.isInitialized()) {
                alert('Please launch a SCO first to initialize the API');
                return;
            }
            interactionsDialog.dialog("open");
            $("#interaction-number").val(getElement("cmi.interactions._count"));
        });

        var objectivesDialog = $("#new-objective").dialog({
            autoOpen: false,
            height: 500,
            width: 400,
            buttons: {
                "Save": function() {
                    var prefix = "cmi.objectives." + $("#objective-number").val() + ".";
                    setElement(prefix + "id", $("#objective-id").val());
                    setElement(prefix + "score.raw", $("#objective-score-raw").val());
                    setElement(prefix + "score.min", $("#objective-score-min").val());
                    setElement(prefix + "score.max", $("#objective-score-max").val());
                    setElement(prefix + "status", $("#objective-status").val());

                    objectivesDialog.dialog( "close" );
                },
                Cancel: function() {
                    objectivesDialog.dialog( "close" );
                }
            },
        });
        $("#create-objectives").on('click', function(e) {
            if (!API || !API.isInitialized()) {
                alert('Please launch a SCO first to initialize the API');
                return;
            }
            objectivesDialog.dialog("open");
            $("#objective-number").val(getElement("cmi.objectives._count"));
        });

        $("#launch-tests").button().on('click', function(e) {
            launchTests();
        });

    });
})();

