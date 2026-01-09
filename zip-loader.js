/**
 * SCORM Package ZIP Loader
 * Loads and extracts SCORM packages from ZIP files
 * Uses JSZip library
 */

var ZipLoader = (function() {
    var _files = {};
    var _blobUrls = {};
    var _manifest = null;
    var _scos = [];
    var _packageName = '';

    function _cleanup() {
        for (var path in _blobUrls) {
            URL.revokeObjectURL(_blobUrls[path]);
        }
        _blobUrls = {};
        _files = {};
        _manifest = null;
        _scos = [];
        _packageName = '';
    }

    function _getMimeType(filename) {
        var ext = filename.split('.').pop().toLowerCase();
        var mimeTypes = {
            'html': 'text/html',
            'htm': 'text/html',
            'js': 'text/javascript',
            'mjs': 'text/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'xml': 'application/xml',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'webp': 'image/webp',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf',
            'otf': 'font/otf',
            'eot': 'application/vnd.ms-fontobject',
            'swf': 'application/x-shockwave-flash',
            'pdf': 'application/pdf'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    function _normalizePath(path) {
        return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
    }

    function _getDirectory(path) {
        var idx = path.lastIndexOf('/');
        return idx > -1 ? path.substring(0, idx + 1) : '';
    }

    function _resolvePath(basePath, relativePath) {
        if (relativePath.match(/^(https?:|data:|blob:|javascript:|#|\/\/)/i)) {
            return null;
        }
        var cleanPath = relativePath.split('?')[0].split('#')[0];
        var baseDir = _getDirectory(basePath);
        var parts = (baseDir + cleanPath).split('/');
        var resolved = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === '..') {
                resolved.pop();
            } else if (parts[i] !== '.' && parts[i] !== '') {
                resolved.push(parts[i]);
            }
        }
        return resolved.join('/');
    }

    function _findFile(path) {
        var normalized = _normalizePath(path);
        if (_files[normalized]) return normalized;

        // Case-insensitive search
        var lowerPath = normalized.toLowerCase();
        for (var filePath in _files) {
            if (filePath.toLowerCase() === lowerPath) return filePath;
        }

        // Try without leading directory (some ZIPs have extra folder)
        var parts = normalized.split('/');
        if (parts.length > 1) {
            var withoutFirst = parts.slice(1).join('/');
            for (var filePath in _files) {
                if (filePath.toLowerCase().endsWith('/' + withoutFirst.toLowerCase()) ||
                    filePath.toLowerCase() === withoutFirst.toLowerCase()) {
                    return filePath;
                }
            }
        }

        // Try matching just the filename
        var filename = parts[parts.length - 1].toLowerCase();
        for (var filePath in _files) {
            if (filePath.toLowerCase().endsWith('/' + filename)) {
                // Check if the parent directories roughly match
                var filePartsArr = filePath.split('/');
                var searchPartsArr = normalized.split('/');
                if (filePartsArr.length >= searchPartsArr.length) {
                    return filePath;
                }
            }
        }

        return null;
    }

    // Track current page path for relative link resolution
    var _currentPagePath = '';

    // Script that provides SCORM API access
    // Since we load via srcdoc, we're same-origin with parent and can access API directly
    var _apiInjectionScript = '<script type="text/javascript">\n' +
        '(function(){\n' +
        '  "use strict";\n' +
        '  // Stubs for LMS navigation functions\n' +
        '  window.loadPage=function(){return true;};\n' +
        '  window.unloadPage=function(){return true;};\n' +
        '  window.doNavigation=function(){return true;};\n' +
        '  window.exitSCO=function(){return true;};\n' +
        '  window.goNext=function(){return true;};\n' +
        '  window.goPrev=function(){return true;};\n' +
        '  window.goHome=function(){return true;};\n' +
        '\n' +
        '  // Access parent API directly (same-origin via srcdoc)\n' +
        '  var parentAPI = null;\n' +
        '  try {\n' +
        '    if (window.parent && window.parent.API) {\n' +
        '      parentAPI = window.parent.API;\n' +
        '    } else if (window.parent && window.parent.SCORM_API) {\n' +
        '      parentAPI = window.parent.SCORM_API;\n' +
        '    }\n' +
        '  } catch(e) {\n' +
        '    console.warn("Cannot access parent API:", e);\n' +
        '  }\n' +
        '\n' +
        '  if (parentAPI) {\n' +
        '    // Expose parent API directly\n' +
        '    window.API = parentAPI;\n' +
        '    console.log("SCORM API: Direct parent access ready");\n' +
        '  } else {\n' +
        '    // Fallback: create stub API\n' +
        '    console.warn("Parent API not found, using stub");\n' +
        '    window.API = {\n' +
        '      LMSInitialize:function(p){console.log("Stub LMSInitialize");return"true";},\n' +
        '      LMSFinish:function(p){return"true";},\n' +
        '      LMSGetValue:function(el){return"";},\n' +
        '      LMSSetValue:function(el,val){return"true";},\n' +
        '      LMSCommit:function(p){return"true";},\n' +
        '      LMSGetLastError:function(){return"0";},\n' +
        '      LMSGetErrorString:function(c){return"";},\n' +
        '      LMSGetDiagnostic:function(c){return"";}\n' +
        '    };\n' +
        '  }\n' +
        '\n' +
        '  // Wrapper functions\n' +
        '  window.doLMSInitialize=function(){return window.API.LMSInitialize("");};\n' +
        '  window.doLMSFinish=function(){return window.API.LMSFinish("");};\n' +
        '  window.doLMSGetValue=function(e){return window.API.LMSGetValue(e);};\n' +
        '  window.doLMSSetValue=function(e,v){return window.API.LMSSetValue(e,v);};\n' +
        '  window.doLMSCommit=function(){return window.API.LMSCommit("");};\n' +
        '  window.doLMSGetLastError=function(){return window.API.LMSGetLastError();};\n' +
        '  window.doLMSGetErrorString=function(c){return window.API.LMSGetErrorString(c);};\n' +
        '  window.doLMSGetDiagnostic=function(c){return window.API.LMSGetDiagnostic(c);};\n' +
        '})();\n' +
        '<\/script>\n';

    function _processContent(content, basePath, fileType) {
        var processed = content;

        if (fileType === 'html' || fileType === 'htm') {
            // Inject API script and navigation handler right after <head>
            var navScript = '<script type="text/javascript">\n' +
                'window._scormNavigate = function(href) {\n' +
                '  if (window.parent && window.parent._scormLoadPage) {\n' +
                '    window.parent._scormLoadPage(href);\n' +
                '    return false;\n' +
                '  }\n' +
                '  return true;\n' +
                '};\n' +
                '<\/script>\n';

            var fullInjection = _apiInjectionScript + navScript;

            if (processed.match(/<head[^>]*>/i)) {
                processed = processed.replace(/(<head[^>]*>)/i, '$1\n' + fullInjection);
            } else if (processed.match(/<html[^>]*>/i)) {
                processed = processed.replace(/(<html[^>]*>)/i, '$1\n<head>' + fullInjection + '</head>\n');
            } else {
                processed = fullInjection + processed;
            }
        }

        // Replace relative URLs with blob URLs
        var patterns;
        if (fileType === 'html' || fileType === 'htm') {
            patterns = [
                // src="..." href="..." etc but NOT for external URLs
                { regex: /(\s(?:src|href)=")([^"]+)(")/gi, quote: '"' },
                { regex: /(\s(?:src|href)=')([^']+)(')/gi, quote: "'" },
                // url(...) in inline styles
                { regex: /(url\s*\(\s*")([^"]+)("\s*\))/gi, quote: '"' },
                { regex: /(url\s*\(\s*')([^']+)('\s*\))/gi, quote: "'" },
                { regex: /(url\s*\()([^)'"]+)(\))/gi, quote: '' }
            ];
        } else if (fileType === 'css') {
            patterns = [
                { regex: /(url\s*\(\s*")([^"]+)("\s*\))/gi, quote: '"' },
                { regex: /(url\s*\(\s*')([^']+)('\s*\))/gi, quote: "'" },
                { regex: /(url\s*\()([^)'"]+)(\))/gi, quote: '' },
                { regex: /(@import\s+")([^"]+)(")/gi, quote: '"' },
                { regex: /(@import\s+')([^']+)(')/gi, quote: "'" }
            ];
        } else {
            return processed;
        }

        patterns.forEach(function(p) {
            processed = processed.replace(p.regex, function(match, prefix, url, suffix) {
                url = url.trim();
                // Skip absolute URLs, data URLs, etc
                if (url.match(/^(https?:|data:|blob:|javascript:|#|\/\/)/i)) {
                    return match;
                }
                // Skip empty URLs
                if (!url || url === '') {
                    return match;
                }

                var resolved = _resolvePath(basePath, url);
                var foundPath = resolved ? _findFile(resolved) : null;

                // Check if this is a link to an HTML file
                var cleanUrl = url.split('?')[0].split('#')[0];
                var isHtmlLink = cleanUrl.match(/\.(html?|htm)$/i);
                var isHrefAttr = prefix.toLowerCase().indexOf('href') > -1;

                // For HTML file links, keep original path (navigation handled via JS)
                if (isHtmlLink && isHrefAttr && (fileType === 'html' || fileType === 'htm')) {
                    // We'll handle these with onclick handlers below
                    return match;
                }

                if (foundPath && _blobUrls[foundPath]) {
                    // Preserve query string and hash
                    var extra = '';
                    var qIdx = url.indexOf('?');
                    var hIdx = url.indexOf('#');
                    if (qIdx > -1) extra = url.substring(qIdx);
                    else if (hIdx > -1) extra = url.substring(hIdx);
                    console.log('[ZipLoader] Replaced:', url, '->', foundPath);
                    return prefix + _blobUrls[foundPath] + extra + suffix;
                }
                if (resolved && !foundPath) {
                    console.warn('[ZipLoader] File not found:', url, '-> resolved:', resolved);
                }
                return match;
            });
        });

        // For HTML files, add onclick handlers to links that point to other HTML files
        if (fileType === 'html' || fileType === 'htm') {
            // Match <a href="..."> tags that link to HTML files
            processed = processed.replace(/<a\s+([^>]*href\s*=\s*["']([^"']+\.html?)["'][^>]*)>/gi, function(match, attrs, href) {
                // Skip absolute URLs
                if (href.match(/^(https?:|data:|blob:|javascript:|#|\/\/)/i)) {
                    return match;
                }
                // Add onclick handler
                if (attrs.indexOf('onclick') === -1) {
                    return '<a ' + attrs + ' onclick="return window._scormNavigate(\'' + href.replace(/'/g, "\\'") + '\')">';
                }
                return match;
            });
        }

        return processed;
    }

    function _processAllFiles() {
        console.log('[ZipLoader] Processing files. Total:', Object.keys(_files).length);

        // First: create blob URLs for all non-HTML/CSS files
        for (var path in _files) {
            var ext = path.split('.').pop().toLowerCase();
            if (ext !== 'html' && ext !== 'htm' && ext !== 'css') {
                if (!_blobUrls[path]) {
                    _blobUrls[path] = URL.createObjectURL(_files[path]);
                    if (ext === 'js') {
                        console.log('[ZipLoader] JS blob URL created:', path, '->', _blobUrls[path]);
                    }
                }
            }
        }

        // Second: process and create blob URLs for CSS files (they may reference images)
        var cssPromises = [];
        for (var path in _files) {
            var ext = path.split('.').pop().toLowerCase();
            if (ext === 'css') {
                (function(p) {
                    cssPromises.push(_files[p].text().then(function(content) {
                        var processed = _processContent(content, p, 'css');
                        _files[p] = new Blob([processed], { type: 'text/css; charset=utf-8' });
                        _blobUrls[p] = URL.createObjectURL(_files[p]);
                    }));
                })(path);
            }
        }

        return Promise.all(cssPromises).then(function() {
            console.log('[ZipLoader] CSS processed. Now processing HTML files...');
            console.log('[ZipLoader] Available blob URLs:', Object.keys(_blobUrls).length);

            // Third: process HTML files (they reference CSS and JS which are now blob URLs)
            var htmlPromises = [];
            for (var path in _files) {
                var ext = path.split('.').pop().toLowerCase();
                if (ext === 'html' || ext === 'htm') {
                    (function(p, e) {
                        htmlPromises.push(_files[p].text().then(function(content) {
                            console.log('[ZipLoader] Processing HTML:', p, 'size:', content.length);
                            var processed = _processContent(content, p, e);
                            _files[p] = new Blob([processed], { type: 'text/html; charset=utf-8' });
                            _blobUrls[p] = URL.createObjectURL(_files[p]);
                            console.log('[ZipLoader] HTML blob URL created:', p);
                        }));
                    })(path, ext);
                }
            }
            return Promise.all(htmlPromises);
        });
    }

    function _parseManifest(xmlString) {
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlString, 'application/xml');

        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Error parsing imsmanifest.xml');
        }

        var manifest = {
            identifier: '',
            version: '',
            schemaVersion: '',
            organizations: [],
            resources: {}
        };

        var manifestEl = xmlDoc.querySelector('manifest');
        if (manifestEl) {
            manifest.identifier = manifestEl.getAttribute('identifier') || '';
            manifest.version = manifestEl.getAttribute('version') || '';
        }

        var schemaVersion = xmlDoc.querySelector('schemaversion');
        if (schemaVersion) {
            manifest.schemaVersion = schemaVersion.textContent.trim();
        }

        xmlDoc.querySelectorAll('resource').forEach(function(resource) {
            var id = resource.getAttribute('identifier');
            manifest.resources[id] = {
                identifier: id,
                type: resource.getAttribute('type'),
                href: resource.getAttribute('href'),
                scormType: resource.getAttribute('adlcp:scormtype') ||
                          resource.getAttributeNS('http://www.adlnet.org/xsd/adlcp_rootv1p2', 'scormtype') ||
                          resource.getAttribute('scormtype')
            };
        });

        xmlDoc.querySelectorAll('organizations > organization').forEach(function(org) {
            var organization = {
                identifier: org.getAttribute('identifier') || '',
                title: '',
                items: []
            };

            var titleEl = org.querySelector(':scope > title');
            if (titleEl) organization.title = titleEl.textContent.trim();

            function parseItems(parentEl) {
                var items = [];
                parentEl.querySelectorAll(':scope > item').forEach(function(item) {
                    var itemData = {
                        identifier: item.getAttribute('identifier') || '',
                        identifierref: item.getAttribute('identifierref') || '',
                        title: '',
                        isvisible: item.getAttribute('isvisible') !== 'false',
                        parameters: item.getAttribute('parameters') || '',
                        items: []
                    };

                    var itemTitleEl = item.querySelector(':scope > title');
                    if (itemTitleEl) itemData.title = itemTitleEl.textContent.trim();

                    if (itemData.identifierref && manifest.resources[itemData.identifierref]) {
                        var resource = manifest.resources[itemData.identifierref];
                        itemData.href = resource.href;
                        itemData.scormType = resource.scormType;
                    }

                    itemData.items = parseItems(item);
                    items.push(itemData);
                });
                return items;
            }

            organization.items = parseItems(org);
            manifest.organizations.push(organization);
        });

        return manifest;
    }

    function _extractSCOs(manifest) {
        var scos = [];

        function findSCOs(items, path) {
            items.forEach(function(item) {
                var itemPath = path ? path + ' > ' + item.title : item.title;

                if (item.scormType && item.scormType.toLowerCase() === 'sco' && item.href) {
                    scos.push({
                        identifier: item.identifier,
                        title: item.title,
                        href: item.href,
                        parameters: item.parameters,
                        path: itemPath,
                        isvisible: item.isvisible
                    });
                }

                if (item.items && item.items.length > 0) {
                    findSCOs(item.items, itemPath);
                }
            });
        }

        manifest.organizations.forEach(function(org) {
            findSCOs(org.items, '');
        });

        return scos;
    }

    return {
        loadZip: function(file) {
            return new Promise(function(resolve, reject) {
                _cleanup();
                _packageName = file.name.replace(/\.zip$/i, '');

                if (typeof JSZip === 'undefined') {
                    reject(new Error('JSZip library is required.'));
                    return;
                }

                new JSZip().loadAsync(file).then(function(contents) {
                    var promises = [];
                    var manifestFound = false;

                    contents.forEach(function(relativePath, zipEntry) {
                        if (!zipEntry.dir) {
                            var normalizedPath = _normalizePath(relativePath);
                            if (normalizedPath.toLowerCase() === 'imsmanifest.xml') {
                                manifestFound = true;
                            }
                            promises.push(zipEntry.async('arraybuffer').then(function(buffer) {
                                _files[normalizedPath] = new Blob([buffer], { type: _getMimeType(normalizedPath) });
                            }));
                        }
                    });

                    if (!manifestFound) {
                        reject(new Error('imsmanifest.xml not found'));
                        return;
                    }

                    return Promise.all(promises);
                }).then(function() {
                    return _processAllFiles();
                }).then(function() {
                    var manifestPath = _findFile('imsmanifest.xml');
                    if (!manifestPath) {
                        reject(new Error('imsmanifest.xml not found'));
                        return;
                    }
                    return _files[manifestPath].text();
                }).then(function(manifestXml) {
                    _manifest = _parseManifest(manifestXml);
                    _scos = _extractSCOs(_manifest);

                    if (_scos.length === 0) {
                        reject(new Error('No SCOs found in package.'));
                        return;
                    }

                    resolve({
                        packageName: _packageName,
                        manifest: _manifest,
                        scos: _scos,
                        fileCount: Object.keys(_files).length
                    });
                }).catch(function(error) {
                    _cleanup();
                    reject(error);
                });
            });
        },

        getScoUrl: function(sco) {
            var href = _normalizePath(sco.href);
            var foundPath = _findFile(href);

            if (!foundPath) {
                return Promise.reject(new Error('SCO file not found: ' + href));
            }

            var url = _blobUrls[foundPath];
            if (sco.parameters) url += sco.parameters;
            return Promise.resolve(url);
        },

        getScoContent: function(sco) {
            var href = _normalizePath(sco.href);
            var foundPath = _findFile(href);
            if (!foundPath) {
                return Promise.reject(new Error('SCO file not found: ' + href));
            }
            _currentPagePath = foundPath;
            return _files[foundPath].text();
        },

        // Navigate to another page within the SCORM package (for srcdoc navigation)
        navigateToPage: function(relativePath) {
            // Resolve path relative to current page
            var resolved = _resolvePath(_currentPagePath, relativePath);
            var foundPath = resolved ? _findFile(resolved) : null;

            if (!foundPath) {
                // Try direct lookup
                foundPath = _findFile(relativePath);
            }

            if (foundPath && _files[foundPath]) {
                _currentPagePath = foundPath;
                return _files[foundPath].text();
            }
            console.error('Page not found:', relativePath, '(resolved:', resolved, ')');
            return Promise.reject(new Error('Page not found: ' + relativePath));
        },

        getCurrentPagePath: function() {
            return _currentPagePath;
        },

        getFileUrl: function(path) {
            var foundPath = _findFile(path);
            return (foundPath && _blobUrls[foundPath]) ? _blobUrls[foundPath] : null;
        },

        getSCOs: function() { return _scos; },
        getManifest: function() { return _manifest; },
        getPackageName: function() { return _packageName; },
        getFiles: function() { return Object.keys(_files); },
        cleanup: function() { _cleanup(); },
        isLoaded: function() { return _manifest !== null && _scos.length > 0; }
    };
})();
