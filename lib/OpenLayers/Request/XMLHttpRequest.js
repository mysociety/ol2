// XMLHttpRequest.js Copyright (C) 2010 Sergey Ilinsky (http://www.ilinsky.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @requires OpenLayers/Request.js
 */

(function () {

    // Save reference to earlier defined object implementation (if any)
    var oXMLHttpRequest    = window.XMLHttpRequest;

    // Enables "XMLHttpRequest()" call next to "new XMLHttpReques()"
    function fXMLHttpRequest() {
        this._object    = new oXMLHttpRequest;
        this._listeners    = [];
    };

    // Constructor
    function cXMLHttpRequest() {
        return new fXMLHttpRequest;
    };
    cXMLHttpRequest.prototype    = fXMLHttpRequest.prototype;

    // Constants
    cXMLHttpRequest.UNSENT                = 0;
    cXMLHttpRequest.OPENED                = 1;
    cXMLHttpRequest.HEADERS_RECEIVED    = 2;
    cXMLHttpRequest.LOADING                = 3;
    cXMLHttpRequest.DONE                = 4;

    // Public Properties
    cXMLHttpRequest.prototype.readyState    = cXMLHttpRequest.UNSENT;
    cXMLHttpRequest.prototype.responseText    = '';
    cXMLHttpRequest.prototype.responseXML    = null;
    cXMLHttpRequest.prototype.status        = 0;
    cXMLHttpRequest.prototype.statusText    = '';

    // Priority proposal
    cXMLHttpRequest.prototype.priority        = "NORMAL";

    // Instance-level Events Handlers
    cXMLHttpRequest.prototype.onreadystatechange    = null;

    // Class-level Events Handlers
    cXMLHttpRequest.onreadystatechange    = null;
    cXMLHttpRequest.onopen                = null;
    cXMLHttpRequest.onsend                = null;
    cXMLHttpRequest.onabort                = null;

    // Public Methods
    cXMLHttpRequest.prototype.open    = function(sMethod, sUrl, bAsync, sUser, sPassword) {
        // Delete headers, required when object is reused
        delete this._headers;

        // When bAsync parameter value is omitted, use true as default
        if (arguments.length < 3)
            bAsync    = true;

        // Save async parameter for fixing Gecko bug with missing readystatechange in synchronous requests
        this._async        = bAsync;

        // Set the onreadystatechange handler
        var oRequest    = this,
            nState        = this.readyState,
            fOnUnload;

        // Add method sniffer
        if (cXMLHttpRequest.onopen)
            cXMLHttpRequest.onopen.apply(this, arguments);

        if (arguments.length > 4)
            this._object.open(sMethod, sUrl, bAsync, sUser, sPassword);
        else
        if (arguments.length > 3)
            this._object.open(sMethod, sUrl, bAsync, sUser);
        else
            this._object.open(sMethod, sUrl, bAsync);

        this.readyState    = cXMLHttpRequest.OPENED;
        fReadyStateChange(this);

        this._object.onreadystatechange    = function() {
            // Synchronize state
            oRequest.readyState        = oRequest._object.readyState;

            //
            fSynchronizeValues(oRequest);

            // BUGFIX: Firefox fires unnecessary DONE when aborting
            if (oRequest._aborted) {
                // Reset readyState to UNSENT
                oRequest.readyState    = cXMLHttpRequest.UNSENT;

                // Return now
                return;
            }

            if (oRequest.readyState == cXMLHttpRequest.DONE) {
                // Free up queue
                delete oRequest._data;
/*                if (bAsync)
                    fQueue_remove(oRequest);*/
                //
                fCleanTransport(oRequest);
            }

            // BUGFIX: Some browsers (Internet Explorer, Gecko) fire OPEN readystate twice
            if (nState != oRequest.readyState)
                fReadyStateChange(oRequest);

            nState    = oRequest.readyState;
        }
    };
    function fXMLHttpRequest_send(oRequest) {
        oRequest._object.send(oRequest._data);
    };
    cXMLHttpRequest.prototype.send    = function(vData) {
        // Add method sniffer
        if (cXMLHttpRequest.onsend)
            cXMLHttpRequest.onsend.apply(this, arguments);

        if (!arguments.length)
            vData    = null;

        // BUGFIX: Safari - fails sending documents created/modified dynamically, so an explicit serialization required
        // BUGFIX: IE - rewrites any custom mime-type to "text/xml" in case an XMLNode is sent
        // BUGFIX: Gecko - fails sending Element (this is up to the implementation either to standard)
        if (vData && vData.nodeType) {
            vData    = window.XMLSerializer ? new window.XMLSerializer().serializeToString(vData) : vData.xml;
            if (!this._headers["Content-Type"])
                this._object.setRequestHeader("Content-Type", "application/xml");
        }

        this._data    = vData;
/*
        // Add to queue
        if (this._async)
            fQueue_add(this);
        else*/
            fXMLHttpRequest_send(this);
    };
    cXMLHttpRequest.prototype.abort    = function() {
        // Add method sniffer
        if (cXMLHttpRequest.onabort)
            cXMLHttpRequest.onabort.apply(this, arguments);

        // BUGFIX: Gecko - unnecessary DONE when aborting
        if (this.readyState > cXMLHttpRequest.UNSENT)
            this._aborted    = true;

        this._object.abort();

        // BUGFIX: IE - memory leak
        fCleanTransport(this);

        this.readyState    = cXMLHttpRequest.UNSENT;

        delete this._data;
/*        if (this._async)
            fQueue_remove(this);*/
    };
    cXMLHttpRequest.prototype.getAllResponseHeaders    = function() {
        return this._object.getAllResponseHeaders();
    };
    cXMLHttpRequest.prototype.getResponseHeader    = function(sName) {
        return this._object.getResponseHeader(sName);
    };
    cXMLHttpRequest.prototype.setRequestHeader    = function(sName, sValue) {
        // BUGFIX: IE - cache issue
        if (!this._headers)
            this._headers    = {};
        this._headers[sName]    = sValue;

        return this._object.setRequestHeader(sName, sValue);
    };

    // EventTarget interface implementation
    cXMLHttpRequest.prototype.addEventListener    = function(sName, fHandler, bUseCapture) {
        for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++)
            if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture)
                return;
        // Add listener
        this._listeners.push([sName, fHandler, bUseCapture]);
    };

    cXMLHttpRequest.prototype.removeEventListener    = function(sName, fHandler, bUseCapture) {
        for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++)
            if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture)
                break;
        // Remove listener
        if (oListener)
            this._listeners.splice(nIndex, 1);
    };

    cXMLHttpRequest.prototype.dispatchEvent    = function(oEvent) {
        var oEventPseudo    = {
            'type':            oEvent.type,
            'target':        this,
            'currentTarget':this,
            'eventPhase':    2,
            'bubbles':        oEvent.bubbles,
            'cancelable':    oEvent.cancelable,
            'timeStamp':    oEvent.timeStamp,
            'stopPropagation':    function() {},    // There is no flow
            'preventDefault':    function() {},    // There is no default action
            'initEvent':        function() {}    // Original event object should be initialized
        };

        // Execute onreadystatechange
        if (oEventPseudo.type == "readystatechange" && this.onreadystatechange)
            (this.onreadystatechange.handleEvent || this.onreadystatechange).apply(this, [oEventPseudo]);

        // Execute listeners
        for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++)
            if (oListener[0] == oEventPseudo.type && !oListener[2])
                (oListener[1].handleEvent || oListener[1]).apply(this, [oEventPseudo]);
    };

    //
    cXMLHttpRequest.prototype.toString    = function() {
        return '[' + "object" + ' ' + "XMLHttpRequest" + ']';
    };

    cXMLHttpRequest.toString    = function() {
        return '[' + "XMLHttpRequest" + ']';
    };

    // Helper function
    function fReadyStateChange(oRequest) {
        // Sniffing code
        if (cXMLHttpRequest.onreadystatechange)
            cXMLHttpRequest.onreadystatechange.apply(oRequest);

        // Fake event
        oRequest.dispatchEvent({
            'type':            "readystatechange",
            'bubbles':        false,
            'cancelable':    false,
            'timeStamp':    new Date + 0
        });
    };

    function fGetDocument(oRequest) {
        var oDocument    = oRequest.responseXML,
            sResponse    = oRequest.responseText;
        // Check if there is no error in document
        if (oDocument)
            if (!oDocument.documentElement || (oDocument.documentElement && oDocument.documentElement.tagName == "parsererror"))
                return null;
        return oDocument;
    };

    function fSynchronizeValues(oRequest) {
        try {    oRequest.responseText    = oRequest._object.responseText;    } catch (e) {}
        try {    oRequest.responseXML    = fGetDocument(oRequest._object);    } catch (e) {}
        try {    oRequest.status            = oRequest._object.status;            } catch (e) {}
        try {    oRequest.statusText        = oRequest._object.statusText;        } catch (e) {}
    };

    function fCleanTransport(oRequest) {
        // BUGFIX: IE - memory leak (on-page leak)
        oRequest._object.onreadystatechange    = null;
    };
/*
    // Queue manager
    var oQueuePending    = {"CRITICAL":[],"HIGH":[],"NORMAL":[],"LOW":[],"LOWEST":[]},
        aQueueRunning    = [];
    function fQueue_add(oRequest) {
        oQueuePending[oRequest.priority in oQueuePending ? oRequest.priority : "NORMAL"].push(oRequest);
        //
        setTimeout(fQueue_process);
    };

    function fQueue_remove(oRequest) {
        for (var nIndex = 0, bFound    = false; nIndex < aQueueRunning.length; nIndex++)
            if (bFound)
                aQueueRunning[nIndex - 1]    = aQueueRunning[nIndex];
            else
            if (aQueueRunning[nIndex] == oRequest)
                bFound    = true;
        if (bFound)
            aQueueRunning.length--;
        //
        setTimeout(fQueue_process);
    };

    function fQueue_process() {
        if (aQueueRunning.length < 6) {
            for (var sPriority in oQueuePending) {
                if (oQueuePending[sPriority].length) {
                    var oRequest    = oQueuePending[sPriority][0];
                    oQueuePending[sPriority]    = oQueuePending[sPriority].slice(1);
                    //
                    aQueueRunning.push(oRequest);
                    // Send request
                    fXMLHttpRequest_send(oRequest);
                    break;
                }
            }
        }
    };
*/
    // Internet Explorer 5.0 (missing apply)
    if (!window.Function.prototype.apply) {
        window.Function.prototype.apply    = function(oRequest, oArguments) {
            if (!oArguments)
                oArguments    = [];
            oRequest.__func    = this;
            oRequest.__func(oArguments[0], oArguments[1], oArguments[2], oArguments[3], oArguments[4]);
            delete oRequest.__func;
        };
    };

    // Register new object with window
    /**
     * Class: OpenLayers.Request.XMLHttpRequest
     * Standard-compliant (W3C) cross-browser implementation of the
     *     XMLHttpRequest object.  From
     *     http://code.google.com/p/xmlhttprequest/.
     */
    if (!OpenLayers.Request) {
        /**
         * This allows for OpenLayers/Request.js to be included
         * before or after this script.
         */
        OpenLayers.Request = {};
    }
    OpenLayers.Request.XMLHttpRequest = cXMLHttpRequest;
})();
