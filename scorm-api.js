/**
 * SCORM 1.2 API Simulation
 * Simulates an LMS API for testing SCORM packages locally
 */

var SCORM_API = (function() {
    // Error codes for SCORM 1.2
    var ERROR_CODES = {
        0: 'No error',
        101: 'General exception',
        201: 'Invalid argument error',
        202: 'Element cannot have children',
        203: 'Element not an array - cannot have count',
        301: 'Not initialized',
        401: 'Not implemented error',
        402: 'Invalid set value, element is a keyword',
        403: 'Element is read only',
        404: 'Element is write only',
        405: 'Incorrect data type'
    };

    // Internal state
    var _initialized = false;
    var _finished = false;
    var _lastError = 0;
    var _data = {};
    var _callbacks = [];

    // Default values for read-only elements (simulating LMS data)
    var _defaultData = {
        'cmi._children': 'core,suspend_data,launch_data,comments,objectives,student_data,student_preference,interactions',
        'cmi._version': '3.4',
        'cmi.core._children': 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
        'cmi.core.student_id': 'student_001',
        'cmi.core.student_name': 'Test Student',
        'cmi.core.credit': 'credit',
        'cmi.core.entry': 'ab-initio',
        'cmi.core.lesson_mode': 'normal',
        'cmi.core.lesson_status': 'not attempted',
        'cmi.core.total_time': '0000:00:00',
        'cmi.core.score._children': 'raw,min,max',
        'cmi.launch_data': '',
        'cmi.comments_from_lms': '',
        'cmi.objectives._children': 'id,score,status',
        'cmi.objectives._count': '0',
        'cmi.student_data._children': 'mastery_score,max_time_allowed,time_limit_action',
        'cmi.student_data.mastery_score': '',
        'cmi.student_data.max_time_allowed': '',
        'cmi.student_data.time_limit_action': '',
        'cmi.student_preference._children': 'audio,language,speed,text',
        'cmi.student_preference.audio': '0',
        'cmi.student_preference.language': '',
        'cmi.student_preference.speed': '0',
        'cmi.student_preference.text': '0',
        'cmi.interactions._children': 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency',
        'cmi.interactions._count': '0'
    };

    // Notify callbacks of data changes
    function _notifyChange(element, value, operation) {
        for (var i = 0; i < _callbacks.length; i++) {
            try {
                _callbacks[i](element, value, operation);
            } catch (e) {
                console.error('SCORM API callback error:', e);
            }
        }
    }

    // Check if element is valid according to SCORM 1.2 data model
    function _isValidElement(element) {
        // Direct match
        if (typeof dataModel !== 'undefined' && dataModel[element]) {
            return true;
        }

        // Pattern match (for indexed elements like cmi.objectives.0.id)
        if (typeof dataModel !== 'undefined') {
            for (var pattern in dataModel) {
                if (dataModel[pattern].pattern) {
                    var regex = new RegExp('^' + pattern.replace(/\.n\./g, '\\.(\\d+)\\.').replace(/\.n$/g, '\\.(\\d+)') + '$');
                    if (regex.test(element)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Get the model definition for an element
    function _getModelDef(element) {
        if (typeof dataModel === 'undefined') return null;

        // Direct match
        if (dataModel[element]) {
            return dataModel[element];
        }

        // Pattern match
        for (var pattern in dataModel) {
            if (dataModel[pattern].pattern) {
                var regex = new RegExp('^' + pattern.replace(/\.n\./g, '\\.(\\d+)\\.').replace(/\.n$/g, '\\.(\\d+)') + '$');
                if (regex.test(element)) {
                    return dataModel[pattern];
                }
            }
        }

        return null;
    }

    // Update count for array elements
    function _updateCount(element) {
        var countMatch = element.match(/^(cmi\.(objectives|interactions))\.(\d+)\./);
        if (countMatch) {
            var countElement = countMatch[1] + '._count';
            var index = parseInt(countMatch[3], 10);
            var currentCount = parseInt(_data[countElement] || '0', 10);
            if (index >= currentCount) {
                _data[countElement] = String(index + 1);
            }
        }

        // Handle nested counts (e.g., interactions.n.objectives._count)
        var nestedCountMatch = element.match(/^(cmi\.interactions\.(\d+)\.(objectives|correct_responses))\.(\d+)\./);
        if (nestedCountMatch) {
            var nestedCountElement = nestedCountMatch[1] + '._count';
            var nestedIndex = parseInt(nestedCountMatch[4], 10);
            var nestedCurrentCount = parseInt(_data[nestedCountElement] || '0', 10);
            if (nestedIndex >= nestedCurrentCount) {
                _data[nestedCountElement] = String(nestedIndex + 1);
            }
        }
    }

    return {
        // Initialize communication with the LMS
        LMSInitialize: function(param) {
            if (param !== '') {
                _lastError = 201;
                return 'false';
            }
            if (_initialized) {
                _lastError = 101;
                return 'false';
            }
            if (_finished) {
                _lastError = 101;
                return 'false';
            }

            _initialized = true;
            _lastError = 0;

            // Initialize with default data
            for (var key in _defaultData) {
                if (!_data.hasOwnProperty(key)) {
                    _data[key] = _defaultData[key];
                }
            }

            _notifyChange('', '', 'initialize');
            return 'true';
        },

        // Finish communication with the LMS
        LMSFinish: function(param) {
            if (param !== '') {
                _lastError = 201;
                return 'false';
            }
            if (!_initialized) {
                _lastError = 301;
                return 'false';
            }
            if (_finished) {
                _lastError = 101;
                return 'false';
            }

            _finished = true;
            _lastError = 0;
            _notifyChange('', '', 'finish');
            return 'true';
        },

        // Get a value from the data model
        LMSGetValue: function(element) {
            if (!_initialized) {
                _lastError = 301;
                return '';
            }
            if (_finished) {
                _lastError = 101;
                return '';
            }
            if (!element || element === '') {
                _lastError = 201;
                return '';
            }

            var modelDef = _getModelDef(element);

            // Check for write-only elements
            if (modelDef && modelDef.mod === 'w') {
                _lastError = parseInt(modelDef.readerror || '404', 10);
                return '';
            }

            // Get value
            var value = _data[element];
            if (value === undefined) {
                // Check if it's a valid element that just hasn't been set
                if (_isValidElement(element)) {
                    _lastError = 0;
                    return '';
                }
                _lastError = 201;
                return '';
            }

            _lastError = 0;
            _notifyChange(element, value, 'get');
            return value;
        },

        // Set a value in the data model
        LMSSetValue: function(element, value) {
            if (!_initialized) {
                _lastError = 301;
                return 'false';
            }
            if (_finished) {
                _lastError = 101;
                return 'false';
            }
            if (!element || element === '') {
                _lastError = 201;
                return 'false';
            }

            var modelDef = _getModelDef(element);

            // Check for read-only elements
            if (modelDef && modelDef.mod === 'r') {
                _lastError = parseInt(modelDef.writeerror || '403', 10);
                return 'false';
            }

            // Check for keyword elements
            if (element.indexOf('._children') !== -1 || element.indexOf('._count') !== -1 || element.indexOf('._version') !== -1) {
                _lastError = 402;
                return 'false';
            }

            // Validate format if defined
            if (modelDef && modelDef.format) {
                var formatRegex = new RegExp(modelDef.format);
                if (!formatRegex.test(value)) {
                    _lastError = 405;
                    return 'false';
                }
            }

            // Validate range if defined
            if (modelDef && modelDef.range) {
                var rangeParts = modelDef.range.split('#');
                var numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    var min = parseFloat(rangeParts[0]);
                    var max = parseFloat(rangeParts[1]);
                    if (numValue < min || numValue > max) {
                        _lastError = 405;
                        return 'false';
                    }
                }
            }

            // Set the value
            _data[element] = String(value);
            _updateCount(element);
            _lastError = 0;
            _notifyChange(element, value, 'set');
            return 'true';
        },

        // Commit data to the LMS
        LMSCommit: function(param) {
            if (param !== '') {
                _lastError = 201;
                return 'false';
            }
            if (!_initialized) {
                _lastError = 301;
                return 'false';
            }
            if (_finished) {
                _lastError = 101;
                return 'false';
            }

            _lastError = 0;
            _notifyChange('', '', 'commit');
            return 'true';
        },

        // Get the last error code
        LMSGetLastError: function() {
            return String(_lastError);
        },

        // Get error string for an error code
        LMSGetErrorString: function(errorCode) {
            var code = parseInt(errorCode, 10);
            return ERROR_CODES[code] || 'Unknown error';
        },

        // Get diagnostic information for an error
        LMSGetDiagnostic: function(errorCode) {
            var code = parseInt(errorCode, 10);
            return ERROR_CODES[code] || 'No diagnostic information available';
        },

        // Helper methods for the debugger

        // Register a callback for data changes
        onChange: function(callback) {
            if (typeof callback === 'function') {
                _callbacks.push(callback);
            }
        },

        // Remove a callback
        offChange: function(callback) {
            var index = _callbacks.indexOf(callback);
            if (index > -1) {
                _callbacks.splice(index, 1);
            }
        },

        // Get all stored data
        getAllData: function() {
            return JSON.parse(JSON.stringify(_data));
        },

        // Set multiple values at once (for debugger)
        setData: function(element, value) {
            _data[element] = String(value);
            _updateCount(element);
        },

        // Reset API state
        reset: function() {
            _initialized = false;
            _finished = false;
            _lastError = 0;
            _data = {};
            _notifyChange('', '', 'reset');
        },

        // Check if initialized
        isInitialized: function() {
            return _initialized;
        },

        // Check if finished
        isFinished: function() {
            return _finished;
        },

        // Configure student data (called before SCO launches)
        configure: function(config) {
            if (config.studentId) _defaultData['cmi.core.student_id'] = config.studentId;
            if (config.studentName) _defaultData['cmi.core.student_name'] = config.studentName;
            if (config.launchData) _defaultData['cmi.launch_data'] = config.launchData;
            if (config.masteryScore) _defaultData['cmi.student_data.mastery_score'] = config.masteryScore;
        }
    };
})();

// Expose as global API object (SCORM 1.2 expects window.API)
window.API = SCORM_API;

// Also expose common wrapper function names that some SCOs expect
window.doLMSInitialize = function() { return SCORM_API.LMSInitialize(""); };
window.doLMSFinish = function() { return SCORM_API.LMSFinish(""); };
window.doLMSGetValue = function(element) { return SCORM_API.LMSGetValue(element); };
window.doLMSSetValue = function(element, value) { return SCORM_API.LMSSetValue(element, value); };
window.doLMSCommit = function() { return SCORM_API.LMSCommit(""); };
window.doLMSGetLastError = function() { return SCORM_API.LMSGetLastError(); };
window.doLMSGetErrorString = function(errorCode) { return SCORM_API.LMSGetErrorString(errorCode); };
window.doLMSGetDiagnostic = function(errorCode) { return SCORM_API.LMSGetDiagnostic(errorCode); };

// Provide stub functions that some SCOs expect from the LMS frameset
window.loadPage = window.loadPage || function() {};
window.unloadPage = window.unloadPage || function() {};
window.doNavigation = window.doNavigation || function() {};
