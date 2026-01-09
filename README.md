# SCORM 1.2 Debugger

A standalone web-based debugger for testing and debugging SCORM 1.2 packages without needing an LMS.

## What is this?

This tool allows you to load SCORM 1.2 packages (ZIP files) directly in your browser and debug the communication between the SCO (Shareable Content Object) and the LMS API. It simulates a complete SCORM 1.2 Run-Time Environment, making it easy to test and troubleshoot SCORM content during development.

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                      SCORM Debugger                         │
├─────────────────────────────────┬───────────────────────────┤
│                                 │                           │
│     SCORM Content (iframe)      │     Debugger Panel        │
│                                 │                           │
│   ┌─────────────────────────┐   │  - Stored data table      │
│   │                         │   │  - Common operations      │
│   │   Your SCO runs here    │───│  - API element inspector  │
│   │                         │   │  - Interactions creator   │
│   └─────────────────────────┘   │  - Objectives manager     │
│                                 │  - Real-time log          │
│                                 │                           │
└─────────────────────────────────┴───────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  Simulated LMS   │
         │   SCORM 1.2 API  │
         └──────────────────┘
```

1. **Load**: Drag & drop or select a SCORM ZIP package
2. **Parse**: The tool extracts the package and reads `imsmanifest.xml`
3. **Select**: Choose which SCO to launch from the dropdown
4. **Debug**: Watch API calls in real-time, modify values, test interactions

## Usage

### Using the debugger

1. **Load a package**: Drag a SCORM ZIP file onto the dropzone, or click to browse
2. **Select a SCO**: Use the dropdown in the toolbar to choose which SCO to launch
3. **Launch**: Click the "Launch" button to start the SCO
4. **Debug**: Use the tabs on the right panel:
   - **Stored data**: View all SCORM data elements and their values
   - **Common operations**: Quick buttons to set lesson status, score, etc.
   - **Debugger**: Get/set any SCORM element manually
   - **Interactions**: Create test interactions and objectives
   - **Tests**: Run automated API tests

## Features

- **Standalone operation**: No LMS required, works entirely in the browser
- **Drag & drop loading**: Simply drop your SCORM ZIP file to load it
- **Side-by-side view**: See your content and debug data simultaneously
- **Real-time monitoring**: Watch API calls as they happen
- **Full SCORM 1.2 API**: Complete implementation of all 8 API functions
- **Data manipulation**: Modify any SCORM element on the fly
- **Multi-page support**: Navigation between HTML pages within the package
- **Resizable panels**: Adjust the layout to your preference

## SCORM 1.2 API Support

The debugger implements the complete SCORM 1.2 API:

| Function | Description |
|----------|-------------|
| `LMSInitialize("")` | Initialize communication |
| `LMSFinish("")` | Terminate communication |
| `LMSGetValue(element)` | Retrieve a data element |
| `LMSSetValue(element, value)` | Store a data element |
| `LMSCommit("")` | Persist data |
| `LMSGetLastError()` | Get last error code |
| `LMSGetErrorString(code)` | Get error description |
| `LMSGetDiagnostic(code)` | Get diagnostic info |

## Fork Information

This project is a fork of [jleyva/scorm-debugger](https://github.com/jleyva/scorm-debugger) with significant enhancements:

### Improvements over the original

1. **Standalone mode**: The original was designed to run inside an LMS as a SCO itself. This version runs independently and can load any SCORM package.

2. **ZIP loading**: Added ability to load SCORM packages directly from ZIP files using JSZip.

3. **Modern UI**: New side-by-side layout with resizable panels, drag & drop interface, and improved toolbar.

4. **Simulated LMS API**: Complete SCORM 1.2 API simulation with proper error handling and data validation.

5. **Real-time updates**: The debugger panel updates automatically when the SCO modifies data.

6. **Multi-page navigation**: Support for SCORM packages with multiple HTML pages and internal navigation.

7. **Manifest parsing**: Automatic detection of SCOs from `imsmanifest.xml`.

## License

MIT License - See the original project for full license details.

## Contributing

Issues and pull requests are welcome at [github.com/erseco/scorm-debugger](https://github.com/erseco/scorm-debugger).
