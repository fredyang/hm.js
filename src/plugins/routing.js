//
//#merge

(function ($, hm, undefined) {
    //#end_merge

    //#merge
    var rootNode = hm();
    var toLogicalPath = hm.util.toLogicalPath;
    var hmFn = hm.fn;
    var isString = hm.util.isString;
    var isFunction = $.isFunction;
    var isBoolean = hm.util.isBoolean;
    var isArray = $.isArray;
    var slice = [].slice;
    var defaultOptions = hm.options;
    //#end_merge

    defaultOptions.hashPrefix = "!";
    defaultOptions.routePrefix = "/";

    var listOfRouteSegments = [],

        defaultRouteSegments,

        initialRouteMatchedByPatterns,

        rPlus = /\+/g,

        rLeftSquareBracket = /\[/,

        rRightSquareBracket = /\]$/,

        rRightSquareBracketEnd = /\]$/,

        rSegmentString = /^([^?]*)(\?.*)?$/,

        rQueryString = /^[^?]*\?(.*)$/,

        rStartHash,
    //the path of model which is tracked in query string
        paramPaths = [];

    //convert a param string into an object
    function deparam(paramString, coerce) {

        var obj = {},
            coerce_types = { 'true': true, 'false': true, 'null': null };

        // Iterate over all name=value pairs.
        $.each(paramString.replace(rPlus, ' ').split('&'), function (index, value) {
            var param = value.split('='),
                key = decodeURIComponent(param[0]),
                val,
                cur = obj,
                i = 0,

            // If key is more complex than 'foo', like 'a[]' or 'a[b][c]', split it
            // into its component parts.
                keys = key.split(']['),
                keys_last = keys.length - 1;

            // If the first keys part contains [ and the last ends with ], then []
            // are correctly balanced.
            if (rLeftSquareBracket.test(keys[0]) && rRightSquareBracket.test(keys[ keys_last ])) {

                // Remove the trailing ] from the last keys part.
                keys[ keys_last ] = keys[ keys_last ].replace(rRightSquareBracketEnd, '');

                // Split first keys part into two parts on the [ and add them back onto
                // the beginning of the keys array.
                keys = keys.shift().split('[').concat(keys);

                keys_last = keys.length - 1;
            } else {
                // Basic 'foo' style key.
                keys_last = 0;
            }

            // Are we dealing with a name=value pair, or just a name?
            if (param.length === 2) {
                val = decodeURIComponent(param[1]);

                // Coerce values.
                if (coerce) {
                    val = val && !isNaN(val) ? +val              // number
                        : val === 'undefined' ? undefined         // undefined
                        : coerce_types[val] !== undefined ? coerce_types[val] // true, false, null
                        : val;                                                // string
                }

                if (keys_last) {
                    // Complex key, build deep object structure based on a few rules:
                    // * The 'cur' pointer starts at the object top-level.
                    // * [] = array push (n is set to array length), [n] = array if n is
                    //   numeric, otherwise object.
                    // * If at the last keys part, set the value.
                    // * For each keys part, if the current level is undefined create an
                    //   object or array based on the type of the next keys part.
                    // * Move the 'cur' pointer to the next level.
                    // * Rinse & repeat.
                    for (; i <= keys_last; i++) {
                        key = keys[i] === '' ? cur.length : keys[i];
                        cur = cur[key] = i < keys_last ?
                            cur[key] || ( keys[i + 1] && isNaN(keys[i + 1]) ? {} : [] )
                            : val;
                    }

                } else {
                    // Simple key, even simpler rules, since only scalars and shallow
                    // arrays are allowed.

                    if (isArray(obj[key])) {
                        // val is already an array, so push on the next value.
                        obj[key].push(val);

                    } else if (obj[key] !== undefined) {
                        // val isn't an array, but since a second value has been specified,
                        // convert val into an array.
                        obj[key] = [ obj[key], val ];

                    } else {
                        // val is a scalar.
                        obj[key] = val;
                    }
                }

            } else if (key) {
                // No value was defined, so set something meaningful.
                obj[key] = coerce ? undefined : '';
            }
        });

        return obj;
    }

    function getHash() {
        rStartHash = rStartHash || new RegExp("^#" + defaultOptions.hashPrefix + defaultOptions.routePrefix);
        return location.hash.replace(rStartHash, "");
    }

    function getCurrentPath() {
        var hash = getHash();
        var match = rSegmentString.exec(hash);
        return match && match[1] || "";
    }

    function getQueryString() {
        var hash = getHash();
        var match = rQueryString.exec(hash);
        return match && match[1] || "";
    }

    //get state from query string
    function getStateFromQueryString() {
        return deparam(getQueryString());
    }

    //handler for model change
    //this model is tracked in the query string
    //when model change we want to update the query string
    function updateQueryStringOnModelChange(e) {

        var queriedPath = toLogicalPath(e.publisher.path),
            model = {};

        model[queriedPath] = rootNode.get(queriedPath);

        //build the hash string
        //1.call getStageFromQueryString
        //2.merge the state in query string with the state
        //3.convert the merged object into query string
        //4. replace hash's query string with the new query string
        var queryString = getQueryString();
        var existingState = deparam(queryString);
        var newState = $.extend({}, existingState, model);
        var newHash = getCurrentPath() + "?" + $.param(newState);

        location.hash = defaultOptions.hashPrefix + defaultOptions.routePrefix + newHash;

    }

    //when model change try to update the route by
    //enumerating the the list of segment patterns array
    //if one segment patterns array match the current route, then
    //enumerate the segment patterns array to find out if
    //a pattern's model path is equal to the path of the changed model
    //then update the path with the updated model's value
    function updatePathOnModelChange(e) {

        var routeSegment,
            pathSegments,
            newPath,
            queryString,
            modelPathOfPublisher = e.publisher.path,
            routeSegments = e.handler.options,
            path = getCurrentPath();

        if (isPathMatchedByRouteSegments(path, routeSegments)) {

            pathSegments = path.split("/");

            for (var j = 0; j < pathSegments.length; j++) {

                routeSegment = routeSegments[j];

                if (routeSegment.startsWith(":")) {

                    var modelPathInRouteSegment = routeSegment.substr(1);

                    if (modelPathInRouteSegment == modelPathOfPublisher) {

                        pathSegments[j] = rootNode.get(modelPathOfPublisher);
                        newPath = pathSegments.join("/");
                        queryString = getQueryString();
                        //console.log( queryString ? newPath + "?" + queryString : newPath );
                        location.hash = defaultOptions.hashPrefix + defaultOptions.routePrefix + (queryString ? newPath + "?" + queryString : newPath);
                        return;
                    }
                }
            }
        }
    }

    function isPathMatchedByRouteSegments(path, routeSegments) {

        var routeSegment,
            pathSegments;

        if (!path) {
            return;
        }

        pathSegments = path.split("/");

        if (pathSegments.length !== routeSegments.length) {
            return;
        }
        var isMatched = true;

        for (var i = 0; i < pathSegments.length; i++) {

            routeSegment = routeSegments[i];

            //if routeSegment is model path
            //don't need to match
            if (routeSegment.startsWith(":")) {
                continue;
            }

            if (routeSegment != pathSegments[i]) {
                isMatched = false;
                break;
            }
        }

        return isMatched;
    }

    //check if current segment string is matched with segment patterns, and return matched status
    //if matched also update the model value with the segment value
    //if this method is called in registration process, also registration handler to subscribe
    //the change of model, when model change update the segment string
    function processPathWithRouteSegments(path, routeSegments, isRegistration) {

        var routeSegment,
            pathSegments,
            modelPathInRouteSegment,
            isPathMatched = isPathMatchedByRouteSegments(path, routeSegments);

        pathSegments = path.split("/");

        for (var i = 0; i < routeSegments.length; i++) {

            routeSegment = routeSegments[i];

            if (routeSegment.startsWith(":")) {
                modelPathInRouteSegment = routeSegment.substr(1);

                if (isPathMatched) {
                    rootNode.set(modelPathInRouteSegment, pathSegments[i]);
                }

                if (isRegistration) {
                    hm.sub(null/* null subscriber*/, modelPathInRouteSegment, "afterUpdate", updatePathOnModelChange, routeSegments);
                }
            }
        }

        return isPathMatched;
    }

    function replaceUrlWithModelState(segmentString, stateInQueryString) {

        var isEmptyQuery = $.isEmptyObject(stateInQueryString);
        if (!segmentString && isEmptyQuery) {
            return;
        }

        var currentHash = location.hash,
            urlPath = location.href.replace(currentHash, ""),
            newHash = defaultOptions.hashPrefix + defaultOptions.routePrefix + segmentString + (isEmptyQuery ? "" : "?" + $.param(stateInQueryString)),
            newUrl = urlPath + "#" + newHash;

        if (history.replaceState) {
            history.replaceState(null, null, newUrl);

        } else {
            location.href = newUrl;

        }
    }

    //register the model path which will be tracked through the query string
    //routeParams should be called after model initialization
    //but before subscription registration,
    // so that the state in query string can be restored
    hm.routeParams = function (/* path1, path2, .. */) {

        var i,
            modelPath,
            args = arguments,
            stateInQueryString = getStateFromQueryString();

        //update the model if model path is in query string
        for (i = 0; i < args.length; i++) {

            modelPath = args[i];

            //if modelPath is in the query string
            //update the model with the value in query string
            if (modelPath in stateInQueryString) {

                rootNode.set(modelPath, stateInQueryString[modelPath]);
            }

            //update query string when model change
            hm.sub(null, modelPath, "afterUpdate", updateQueryStringOnModelChange);
            paramPaths.push(args[i]);
        }

        return this;
    };

    hmFn.routeParams = function (subPath) {

        var model = this;

        hm.routeParams.apply(

            hm,

            $.map(subPath ? arguments : [""],
                function (subPath) {
                    return model.getPath(subPath);
                }
            )
        );

        return model;

    };

    //register the segment patterns which will be used to match a path
    //a path is consists of multiple segment
    // A path like "/public/config/personal", consist of segments ["public", "config", "personal"]
    //this method try to use a matcher to test each segments
    //hm.route(segmentMatcher1, segmentMatcher2, ...)
    //each segment matcher is like [path, matcher]
    //so it is like
    //hm.route([path1, matcher1], [path2, matcher2], ...);
    //example of segment pattern are as following
    //string eg:  "public", which is a fixed value, which does not mapped to a model
    //the following mapped to a model
    //array eg: [ "modelPath", null] or [ "modelPath"], constraint is null
    //array eg: [ "modelPath", "fixedValue" ], constraint is "fixedValue"
    //array eg: [ "modelPath", /regex/ ], constraint is regular expression
    //array eg: [ "modelPath", function (segment) { return boolean; } ], constraint is a function
    hm.routePath = function (route, isDefault) {

        var routeSegments = route.split("/");

        listOfRouteSegments.push(routeSegments);

        if (isDefault) {
            defaultRouteSegments = routeSegments;
        }

        var currentPath = getCurrentPath();

        if (processPathWithRouteSegments(currentPath, routeSegments, true)) {
            initialRouteMatchedByPatterns = true;
        }
    };

    hm.updateRoute = function /*updateModelWhenHashChanged*/() {


        //update model when segment string change
        var i, modelPath,
            segmentString = getCurrentPath(),
            stateInQueryString = getStateFromQueryString();

        if (segmentString) {
            for (i = 0; i < listOfRouteSegments.length; i++) {
                if (processPathWithRouteSegments(segmentString, listOfRouteSegments[i])) {
                    //shortcut when the first segment patterns match
                    break;
                }
            }

            //if segmentString is empty and it has defaultSegmentPattern
            //try to build a segment string from the default segment patterns
        } else if (defaultRouteSegments) {

            var segments = [];
            for (i = 0; i < defaultRouteSegments.length; i++) {

                var segmentPattern = defaultRouteSegments[i];

                if (isString(segmentPattern)) {
                    segments.push(segmentPattern);

                } else {

                    var modelValue = rootNode.get(segmentPattern[0]) + "";
                    segments.push(modelValue || segmentPattern.defaultValue || "");
                }
            }

            segmentString = segments.join("/");
        }

        //update model when query string change
        for (modelPath in stateInQueryString) {
            if (paramPaths.contains(modelPath)) {
                rootNode.set(modelPath, stateInQueryString[modelPath]);
            }
        }

        //update state in query string
        for (i = 0; i < paramPaths.length; i++) {
            modelPath = paramPaths[i];
            stateInQueryString[modelPath] = rootNode.get(modelPath);
        }
        //
        replaceUrlWithModelState(segmentString, stateInQueryString);
    };

    //update model when hash change
    $(window).bind("hashchange", hm.updateRoute);

    $(function () {

        //try to build the initial hash from the model

        var i, route = "";

        //if there is default segment pattern and the initial segment string
        //is not matched by any patterns, then use the default segment pattern
        //to build the segment string
        if (defaultRouteSegments && !initialRouteMatchedByPatterns) {

            var pathSegments = [];
            for (i = 0; i < defaultRouteSegments.length; i++) {
                var routeSegment = defaultRouteSegments[i];

                if (routeSegment.startsWith(":")) {

                    pathSegments.push(rootNode.get(routeSegment.substr(1)) + "");

                } else {

                    pathSegments.push(routeSegment);
                }
            }

            route = pathSegments.join("/");

        } else {

            route = getCurrentPath();
        }

        var stateInQueryString = getStateFromQueryString();

        //update state in query string
        for (i = 0; i < paramPaths.length; i++) {
            var modelPath = paramPaths[i];
            stateInQueryString[modelPath] = rootNode.get(modelPath);
        }
        replaceUrlWithModelState(route, stateInQueryString);
    });

    //#debug

    //#end_debug

    //#merge
})(jQuery, hm);
//#end_merge
