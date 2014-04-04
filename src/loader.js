//
//#merge
(function( $, hm, undefined ) {

	var
		slice = [].slice,
		isObject = hm.util.isObject,
		isBoolean = hm.util.isBoolean,
		isString = hm.util.isString,
		isUndefined = hm.util.isUndefined,
		isArray = $.isArray;
	//#end_merge

	//start of loader core.js
	var urlStore = {},
		promiseStore = {},
		dependencyStore = {},
		loaderDefinitionStore = {},
		loaderStore = {},
		dummyLink = document.createElement( "a" ),
		rComma = /,/,
		rSpace = /\s+/g,
		rQuery = /\?/,
		rFileExt = /\.(\w+)$/,
		rFileName = /(.+)\.\w+$/,
		fileExtension,
		fileName,
		commonLoaderMethods,
		commonLoadFilters,
		depend,
	//match "http://domain.com" , "/jkj"
		rAbsoluteUrl = /^http[s]?:\/\/|^\//,
		rUrlParts = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/,
		ajaxLocParts = rUrlParts.exec( location.href.toLowerCase() ) || [],
		hashValue = "",
		hashKey = "v",
		rVersionHash,
		loadCallbacks = [],
		failCallbacks = [],
		unloadCallbacks = [],

		loaderFinders,
		fileExtToLoaderMapper = {},
		baseUrl = "",

	//support the following overloading
	//hm.loader("app"); //retrieve loader
	//hm.loader("app", definition); //create a loader from scratch
	//hm.loader("app", "js", definition); //create a loader by extending a new loader
		_loader = hm.loader = function( loaderName, baseLoaderName, loaderDefinition ) {


			//retrieve the loader by name
			if (isUndefined( baseLoaderName )) {

				return loaderName ? loaderStore[loaderName] : loaderStore;

			}

			//create a new loader
			if (!isString( baseLoaderName )) {
				loaderDefinition = baseLoaderName;
				baseLoaderName = null;
			}

			loaderDefinition = loaderDefinitionStore[loaderName] = $.extend(
				true,
				{},
				loaderDefinitionStore[baseLoaderName],
				loaderDefinition );

			var loader = $.extend( true, {}, loaderDefinition );

			$.each( "load,unload,url,depend".split( "," ), function( index, methodName ) {
				var commonMethodName = loader[methodName];
				if (isString( commonMethodName )) {
					var loaderMethod = commonLoaderMethods[methodName][commonMethodName];
					if (loaderMethod) {
						loader[methodName] = loaderMethod;
					}
				}
			} );

			if ($.isPlainObject( loader.load )) {
				//it is a pipeline, but not a function
				loader.load = convertLoadFiltersToLoadMethod( loader.load );

			}

			if (!$.isFunction( loader.load )) {
				throw "missing load function from loader";
			}

			loaderStore[loaderName] = $.extend( {}, loaderStore[baseLoaderName], loader );
		};

	function invokeCallbacks( callbacks ) {
		return function() {
			for (var i = 0; i < callbacks.length; i++) {
				callbacks[i].apply( this, arguments );
			}
		};
	}

	var invokeFailCallbacks = invokeCallbacks( failCallbacks ),
		invokeLoadCallbacks = invokeCallbacks( loadCallbacks ),
		invokeUnloadCallbacks = invokeCallbacks( unloadCallbacks );

	function loadAssets( assetIds, inferDependenciesFromIdOrder ) {

		if (isString( assetIds )) {

			if (inferDependenciesFromIdOrder) {
				var i = 1,
					keys = splitByComma( assetIds );

				//create dependency in order
				while (i < keys.length) {
					depend( keys[i], keys[i - 1] );
					i++;
				}
				assetIds = keys[keys.length - 1];
			}

			return loadAssetsInParallel( assetIds );

		} else if (isArray( assetIds )) {

			//if it is assetIdArray, load one after previous is fully loaded
			return loadAssetsInSerial( assetIds );

		}
		throw "resource parameter should be an array or string";
	}

	//resourceString is like "a.js, b.css, c.tmpl"
	function loadAssetsInParallel( assetIdString ) {
		var promises = [],
			rtnPromise,
			resourceArray = splitByComma( assetIdString );

		if (resourceArray.length === 1) {
			rtnPromise = loadStandaloneAsset( resourceArray[0] );
		}
		else {
			for (var i = 0; i < resourceArray.length; i++) {
				promises.push( loadStandaloneAsset( resourceArray[i] ) );
			}
			rtnPromise = $.when.apply( $, promises );
		}

		return augmentPromise( rtnPromise ).fail( function() {
			_loader.unload( assetIdString );
		} );
	}

	//resources can be "a.js, b.css, c.tmpl"
	//it can be ["a.js", "b.css", "c.tmpl"]
	//or ["a.js,b.css", ["c.tmpl", "d.tmpl"], "e.css"] and so on
	//it serial load the top level resource unit, within each resource unit, use smart
	//loader
	function loadAssetsInSerial( assetIdArray ) {
		var rtnPromise,
			i,
			toReleaseResource = [],
			currentResourceStringOrArray,
			sharedState = {
				ok: true
			};

		for (i = 0; i < assetIdArray.length; i++) {
			currentResourceStringOrArray = assetIdArray[i];
			toReleaseResource.push( currentResourceStringOrArray );

			if (i === 0) {

				rtnPromise = loadAssets( currentResourceStringOrArray )
					.fail( makeReleaseFn( currentResourceStringOrArray, sharedState ) );

			} else {

				rtnPromise = rtnPromise.nextLoad( currentResourceStringOrArray )
					.fail( makeReleaseFn( toReleaseResource.slice(), sharedState ) );
			}
		}

		return augmentPromise( rtnPromise );
	}

	function makeReleaseFn( resourceStringOrArray, sharedState ) {
		return function() {
			if (sharedState.ok) {
				_loader.unload( resourceStringOrArray );
				sharedState.ok = false;
			}
		};
	}

	function loadStandaloneAsset( assetId ) {
		var loader = findLoader( assetId );
		if (loader) {

			return loadStandaloneAssetWithLoader( assetId, loader );

		} else {

			//#debug
			_loader.debug.log( "try to load missing loader " + fileExtension( assetId ) + ".loader" );
			//#end_debug

			return _loader.load( fileExtension( assetId ) + ".loader" ).nextLoad( assetId );
		}
	}

	function loadStandaloneAssetWithLoader( assetId, loader ) {

		//#debug
		_loader.debug.log( "try to load " + assetId + " @ " + _loader.url( assetId ) );
		//#end_debug

		var promise = accessPromise( assetId );

		if (!promise) {

			//#debug
			_loader.debug.log( "  loading " + assetId + " @ " + _loader.url( assetId ) );
			//#end_debug

			promise = loader.load( assetId );

			if (!loader.noRefCount) {
				//add the promise to cache,
				//in the future, it can be retrieved by accessPromise(assetId)
				accessPromise( assetId, promise );
			}
		}
		//#debug
		else {
			_loader.debug.log( "  found loaded asset " + assetId + " @ " + _loader.url( assetId ) );
		}
		//#end_debug

		//preload asset will never be counted for reference
		//as we don't want that to be unloaded
		if (promise.refCount !== "staticLoaded") {
			promise.refCount = promise.refCount ? promise.refCount + 1 : 1;
		}
		return promise;
	}

	//retrieve promise by assetId or
	//set promise by assetId
	function accessPromise( assetId, promise ) {
		if (assetId === undefined) {
			return promiseStore;
		} else {
			if (promise === undefined) {
				if (arguments.length === 1) {
					return promiseStore[assetId];
				} else {
					delete promiseStore[assetId];
				}
			} else {
				promiseStore[assetId] = promise;
				return promise;
			}
		}
	}

	//add a promise.nextLoad method dynamically, so that it can
	//be used load other asset when current promise finished
	//the nextLoad method is a smartLoad method, use the same way in which
	//you call loader
	function augmentPromise( promise ) {
		var nextDefer = $.Deferred();

		//nextLoad method load after the current currentPromise is done
		promise.nextLoad = function( assetId ) {
			var nextLoadArguments = slice.call( arguments );
			promise.then(
				function() {
					_loader.load.apply( null, nextLoadArguments ).then(
						function() {
							nextDefer.resolve.apply( nextDefer, slice.call( arguments ) );
						},
						function() {
							nextDefer.reject( assetId );
						} );
				},
				function() {
					nextDefer.reject( assetId );
				} );

			return augmentPromise( nextDefer.promise() );
		};

		promise.andLoad = function() {
			var currentPromise = _loader.apply( null, arguments );
			return augmentPromise( $.when( currentPromise, promise ) );
		};

		return promise;
	}

	function splitByComma( text ) {
		return text.replace( rSpace, "" ).split( rComma );
	}

	function isCrossDomain( url ) {
		var parts = rUrlParts.exec( url.toLowerCase() );
		return !!( parts &&
		           ( parts[ 1 ] != ajaxLocParts[ 1 ] || parts[ 2 ] != ajaxLocParts[ 2 ] ||
		             ( parts[ 3 ] || ( parts[ 1 ] === "http:" ? 80 : 443 ) ) !=
		             ( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? 80 : 443 ) ) )
			);
	}

	function fullUrl( urlRelativeToBaseUrl ) {

		dummyLink.href = rAbsoluteUrl.test( urlRelativeToBaseUrl ) ? urlRelativeToBaseUrl :
			baseUrl + urlRelativeToBaseUrl;

		return isCrossDomain( urlRelativeToBaseUrl ) ? dummyLink.href : addHash( dummyLink.href );
	}

	function convertLoadFiltersToLoadMethod( loadFilters ) {

		for (var key in loadFilters) {
			attachFilter( loadFilters, key );
		}

		var staticLoaded = loadFilters.staticLoaded || commonLoadFilters.staticLoaded.returnFalse,
			getSource = loadFilters.getSource || commonLoadFilters.getSource.getTextByAjax,
			compile = loadFilters.compile === undefined ? commonLoadFilters.compile.globalEval : loadFilters.compile,
			crossSiteLoad = loadFilters.crossSiteLoad || commonLoadFilters.crossSiteLoad.getScript,
			buildDependencies = loadFilters.buildDependencies || commonLoadFilters.buildDependencies.parseDependTag,
			buildUnload = loadFilters.buildUnload || commonLoadFilters.buildUnload.parseUnloadTag;

		if (!compile && !crossSiteLoad) {
			throw "loader must implement at least one of compile, crossSiteLoad";
		}

		return function( assetId ) {
			var defer = $.Deferred(),
				promise = defer.promise(),
				url;

			if (staticLoaded( assetId )) {

				//#debug
				_loader.debug.log( "    bypass staticLoadeded asset " + assetId + " @ " + _loader.url( assetId ) );
				//#end_debug
				promise.refCount = "staticLoaded";
				defer.resolve();

			} else {
				url = _loader.url( assetId );
				if (!compile || loadFilters.byPassGetSource || isCrossDomain( url )) {

					if (!crossSiteLoad) {
						throw "loader does not support cross domain loading";
					}
					//#debug
					_loader.debug.log( "    cross-site fetch " + assetId + " @ " + url );
					//#end_debug

					return crossSiteLoad( assetId );

				} else {

					//#debug
					_loader.debug.log( "    local fetch " + assetId + " @ " + url );
					//#end_debug

					getSource( assetId ).then(
						function( sourceCode ) {

							//#debug
							_loader.debug.log( "      parsing content of " + assetId );
							//#end_debug

							if (buildUnload) {

								//#debug
								_loader.debug.log( "        buildUnload for " + assetId );
								//#end_debug

								var unload = buildUnload( sourceCode, assetId );

								if (unload) {
									//#debug
									_loader.debug.log( "          unload created for " + assetId );
									//#end_debug

									accessPromise( assetId ).unload = unload;
								}

							}

							if (buildDependencies) {

								//#debug
								_loader.debug.log( "        buildDependencies for " + assetId );
								//#end_debug

								var embeddedDependencies = buildDependencies( assetId, sourceCode );
								if (embeddedDependencies) {
									//#debug
									_loader.debug.log( "          dependencies found for " + assetId + ":" + embeddedDependencies );
									//#end_debug
									depend( assetId, embeddedDependencies );
								}
							}

							var runcompile = function() {

								//#debug
								_loader.debug.log( "      compiling " + assetId + " @ " + url );
								//#end_debug

								var result = compile && compile( assetId, sourceCode );
								//delay defer.resolve a for while to wait for the compile result
								//to take effect, if compile is $.globalEval
								setTimeout( function() {
									if (!defer.dontResolve) {
										defer.resolve( result );
										delete promise.defer;
									}
								}, 5 );
							};

							var dependencies = depend( assetId );

							//load dependencies because it combines static dependentModuleString
							//and dynamic dependentModuleString
							if (dependencies) {
								_loader.load( dependencies ).then( runcompile, function() {
									defer.reject( assetId );
									delete promise.defer;
								} );
							} else {
								runcompile();
							}

						},
						function() {
							defer.reject( assetId );
							delete promise.defer;
						}
					);
				}
				if (!isResolved( defer )) {
					promise.defer = defer;
				}
			}
			return promise;
		};
	}

	var isResolved = $.Deferred().isResolved ? function( promise ) {
		return promise.isResolved();
	} : function( promise ) {
		return promise.state() == "resolved";
	};

	function addHash( url ) {
		url = removeHash( url );
		return hashValue ?
			url + ( rQuery.test( url ) ? "&" : "?" ) + hashKey + "=" + hashValue :
			url;
	}

	function removeHash( url ) {
		if (hashValue === "") {
			return url;
		} else {
			return url.replace( rVersionHash, "" );
		}
	}

	$.extend( _loader, {

		//for parallel loading
		//
		// loader.load(assetIdString)
		// loader.load(assetIdString, useImplicitDependencies)
		// loader.load(holdReady, assetIdString)
		// loader.load(holdReady, assetIdString, useImplicitDependencies)
		//
		//for serial loading and mixed serial/parallel loading loader
		//
		// loader.load(assetIdArray)
		// loader.load(holdReady assetIdArray)
		//
		load: function( holdReady, assetIds, inferDependenciesFromIdOrder ) {
			var rtnPromise;
			if (!isBoolean( holdReady )) {
				//by default it is false
				inferDependenciesFromIdOrder = assetIds;
				assetIds = holdReady;
				holdReady = false;
			}
			if (!assetIds) {
				return;
			}

			holdReady = holdReady && !$.isReady;

			rtnPromise = loadAssets( assetIds, inferDependenciesFromIdOrder );

			if (holdReady) {

				$.holdReady( true );

				rtnPromise.done( function() {
					$.holdReady();
					//same as the following
					//$.holdReady( false );
					//$.ready( true );
				} );
			}

			return rtnPromise.done( invokeLoadCallbacks ).fail( invokeFailCallbacks );
		},
		//unload(loadCallback) or unload(unloadCallback, remove=true)
		//unload(assetIdString)
		//unload(assetIdArray)
		unload: function( assetIds, remove ) {
			var i,
				assetId,
				dependencies,
				promise;

			if ($.isFunction( assetIds )) {
				if (remove) {
					unloadCallbacks.remove( assetIds );
				} else {
					unloadCallbacks.push( assetIds );
				}

			} else {

				if (isString( assetIds )) {
					assetIds = splitByComma( assetIds );
				}

				//if there is only one module
				if (assetIds.length != 1) {

					for (i = 0; i < assetIds.length; i++) {
						_loader.unload( assetIds[i] );
					}

				} else {

					//unload serveral modules
					assetId = assetIds[0];
					promise = accessPromise( assetId );

					//make sure it will not throw exception when
					// unloading some module which is not in page
					if (promise && promise.refCount != "staticLoaded") {

						if (--promise.refCount === 0 || remove) {
							var unload = promise.unload || findLoader( assetId ).unload;

							if (unload) {
								//#debug
								_loader.debug.log( "unloading " + assetId + " @ " + _loader.url( assetId ) );
								//#end_debug
								unload( assetId );
							}

							//delete the promises associated with the module
							accessPromise( assetId, undefined );
							dependencies = depend( assetId );
							if (dependencies) {
								_loader.unload( dependencies, remove );
								depend( assetId, undefined );
							}

						}
						invokeUnloadCallbacks();
					}
				}
			}
		},

		//register a url for module key
		//or get the url of module key
		url: function( assetId, url ) {
			if (isObject( assetId )) {
				for (var k in assetId) {
					_loader.url( k, assetId[k] );
				}
				return;
			}

			//if resource's url is not in cache
			//and user is trying to get it
			if (url === undefined) {

				if (arguments.length == 1) {

					if (urlStore[assetId]) {
						return urlStore[assetId];
					}

					var loader = findLoader( assetId );

					return fullUrl(
						loader && loader.url ? loader.url( assetId ) :
							loader && loader.fileExt ? fileName( assetId ) + "." + loader.fileExt :
								assetId
					);

				} else {

					//allow access(key, undefined)
					//to delete the key from storage
					delete urlStore[assetId];
				}

			} else {
				//user explicit register an url
				var oldUrl = _loader.url( assetId );
				var newUrl = fullUrl( url );

				if (oldUrl != newUrl) {
					var oldPromise = accessPromise( assetId );
					if (oldPromise && isResolved( oldPromise )) {
						reload( assetId, function() {
							urlStore[assetId] = newUrl;
						} );
					} else {
						urlStore[assetId] = newUrl;
					}
				}
			}
		},

		// members to configure loader

		//add dependency to a resource key
		//or get the dependency of a resource key
		//user can set dependentResourceString manually , which is called static
		//dependentResourceString
		// or can use loader.depend method to return dependentResourceString which is called
		//dynamic dependentResourceString,
		//or we can combine them together
		depend: depend = function( assetId, dependencies ) {

			if (isObject( assetId )) {
				for (var key in assetId) {
					depend( key, assetId[key] );
				}
				return;
			}

			if (dependencies === undefined) {
				//get dependencies
				if (arguments.length == 1) {
					var staticDependencies = dependencyStore[assetId];
					var loader = findLoader( assetId );

					if (loader && loader.depend) {
						var dynamicDependencies = loader.depend( assetId );
						if (dynamicDependencies && staticDependencies) {
							return dynamicDependencies + "," + staticDependencies;
						} else if (dynamicDependencies) {
							return dynamicDependencies;
						} else {
							return staticDependencies;
						}
					} else {
						return staticDependencies;
					}

				} else {
					//delete dependencies
					delete dependencyStore[assetId];
				}

			} else if (dependencies === true) {
				//for debugging purpuse loader.depend(assetId, true)
				var assetIds = depend( assetId );
				assetIds = assetIds && splitByComma( assetIds );
				if (assetIds) {
					var rtn = [];
					for (var i = 0; i < assetIds.length; i++) {
						if (_loader.fileExt( assetIds[i] ) !== "module") {
							rtn.pushUnique( _loader.url( assetIds[i] ) );
						}
						rtn.merge( depend( assetIds[i], true ) );
					}
					return rtn;
				}

			} else {
				var newStaticDependencies = getNewStaticDependencies( assetId, dependencies );
				var oldStaticDependencies = dependencyStore[assetId];

				if (isDependenciesDifferent( newStaticDependencies, oldStaticDependencies )) {

					var oldPromise = accessPromise( assetId );
					if (oldStaticDependencies && oldPromise && isResolved( oldPromise )) {
						reload( assetId, function() {
							dependencyStore[assetId] = newStaticDependencies;
						} );
					} else {
						dependencyStore[assetId] = newStaticDependencies;
					}
				}
			}
		},

		//the url relative to the current window location, for example "js/"
		//the suffix "/" is important
		//it is used to calculate the real relative url of resource key
		baseUrl: function( urlRelativeToPage ) {
			if (isUndefined( urlRelativeToPage )) {
				return baseUrl;
			}
			baseUrl = urlRelativeToPage.endsWith( "/" ) ? urlRelativeToPage : urlRelativeToPage + "/";
		},

		//loader.hash(true) --> set a timestamp as hash ?v=2347483748
		//loader.hash(1,x) --> ?x=1
		//loader.hash(1) --> ?v=1
		hash: function( value, key ) {
			if (arguments.length) {
				hashValue = value === true ? $.now() : value;
				hashKey = key !== undefined ? key : (hashKey || "v");
				rVersionHash = new RegExp( "[?&]" + hashKey + "=[^&]*" );
			}
			return hashValue === "" ? "" : hashKey + "=" + hashValue;
		},

		//support method load, unload, url, depend
		methods: commonLoaderMethods = {

			load: {
				cacheImage: function( assetId ) {
					var defer = $.Deferred(),
						promise = defer.promise(),
						url = _loader.url( assetId );

					var img = new Image();
					img = new Image();
					img.onload = function() {
						defer.resolve( url );
					};
					img.onerror = function() {
						defer.reject( url );
					};
					img.src = url;
					return promise;
				}

			},
			unload: {
				removeCssLinkTag: function( assetId ) {
					var url = fullUrl( _loader.url( assetId ) );
					$( "link" ).filter(
						function() {
							return this.href === url && $( this ).attr( 'loadedByloader' );
						} ).remove();
				}
			},
			url: {
				assetId: function( assetId ) {
					return assetId;
				},
				//this url expect module is put into its folder under baseUrl
				//if the loader name is "app", we should put the resource file into
				//baseUrl/app folder
				folder: function( assetId ) {

					var fileExt = findLoader( assetId ).fileExt,
						fileName = fileExt ? _loader.fileName( assetId ) + "." + fileExt :
							assetId,
						loaderName = _loader.fileExt( assetId );

					return loaderName + "/" + fileName;
				}
			},

			depend: {
				//name: function (assetId) {
				// return a assetIdString or assetIdArray
				// return "a.html, b.js"
				// }
			}
		},

		loadFilters: commonLoadFilters = {

			staticLoaded: {
				//default staticLoaded filter
				returnFalse: function() {
					return false;
				},

				hasScriptTag: function( assetId ) {
					return !!($( "script" ).filter(
						function() {
							return removeHash( this.src ) === removeHash( _loader.url( assetId ) );
						} ).length);
				}

			},

			getSource: {
				//this is default getSource filter
				getTextByAjax: function( assetId ) {
					return $.ajax( {
						url: _loader.url( assetId ),
						dataType: "text",
						cache: true
					} );
				}
			},

			compile: {
				globalEval: function( assetId, sourceCode ) {
					return $.globalEval( sourceCode );
				},
				localEval: function( assetId, sourceCode ) {
					return eval( sourceCode );
				}
			},

			crossSiteLoad: {
				//can not use $.getScript directly, as loader.resolve
				getScript: function( assetId ) {
					var defer = $.Deferred(),
						promise = defer.promise();

					promise.defer = defer;

					$.getScript( _loader.url( assetId ) ).then(
						function() {
							setTimeout( function() {
								if (!defer.dontResolve) {
									defer.resolve();
									delete promise.defer;
								}
							}, 5 );
						},
						function() {
							defer.reject();
							delete promise.defer;
						} );

					return promise;
				}


			},

			buildUnload: {
				parseUnloadTag: function( sourceCode ) {
					var unloadStatements = runloadStatement.exec( sourceCode );
					return unloadStatements &&
					       unloadStatements[1] &&
					       new Function( unloadStatements[1] );
				}
			},

			buildDependencies: {
				parseDependTag: function( assetId, sourceCode ) {
					var dependencies = rDependHeader.exec( sourceCode );
					return (dependencies && dependencies[1] ) || null;
				}
			}
		},

		//find the name of the loader based on assetId
		//the first loader is use the extension as the loader name
		//however you can add your own loader
		finders: loaderFinders = [
			//find loader by by file extensions directly
			function( assetId ) {
				return fileExtension( assetId );
			},
			//find loader by by file extensions using mapper
			function( assetId ) {
				var extension = fileExtension( assetId );
				var mappedType = fileExtToLoaderMapper[extension];
				if (mappedType) {
					return mappedType;
				}
			}
		],

		//if you want to load a file "*.jpg", which should be loaded
		//with "*.img" loader you should specify loader.loader.mapFiles("img", "jpg");
		mapFileExtToLoader: function( fileExtensions, loaderName ) {
			fileExtensions = splitByComma( fileExtensions );
			for (var i = 0; i < fileExtensions.length; i++) {
				fileExtToLoaderMapper[fileExtensions[i]] = loaderName;
			}
		},

		//if assetId is xyz.js
		//then fileExt is "js"
		fileExt: fileExtension = function( assetId ) {
			return rFileExt.exec( assetId )[1];
		},

		//if assetId is "a.b.c", then file name is "a.b"
		fileName: fileName = function( assetId ) {
			return rFileName.exec( assetId )[1];
		},

		//define a module with an asset id
		//dependencies is an asset expression, it is optional
		//define the module in the load method
		define: function( assetId, dependencies, defineModule, unload ) {

			if ($.isFunction( dependencies )) {
				unload = defineModule;
				defineModule = dependencies;
				dependencies = null;
			}

			var defer, promise = accessPromise( assetId );

			if (!promise) {
				//this is the case when loader.define is call in a static loaded js
				defer = $.Deferred();
				promise = defer.promise();
				promise.defer = defer;
				accessPromise( assetId, promise );
			} else {
				defer = promise.defer;
			}

			//use dontReoslve flag telling the consumer don't resolve it
			//as it will be taken care inside importCode,
			promise.defer.dontResolve = true;

			var runModuleCode = function( result ) {
				delete promise.defer;
				promise.unload = unload;
				defer && defer.resolve( defineModule( result ) );
			};

			if (dependencies) {
				depend( assetId, dependencies );
				//load the dependencies first
				_loader.load( dependencies ).done( runModuleCode );

			} else {

				runModuleCode();
			}

			return promise;
		},

		done: function( fn, remove ) {
			if (remove) {
				loadCallbacks.remove( fn );
			} else {
				loadCallbacks.push( fn );
			}
		},

		fail: function( fn, remove ) {
			if (remove) {
				failCallbacks.remove( fn );
			} else {
				failCallbacks.push( fn );
			}
		},

		defaultLoader: "js"

	} );

	function reload( assetId, change ) {

		var oldPromiseCache = $.extend( true, {}, promiseStore );
		_loader.unload( assetId, true );
		change && change();
		return _loader.load( assetId ).done( function() {
			for (var key in oldPromiseCache) {
				if (promiseStore[key] && oldPromiseCache[key]) {
					promiseStore[key].refCount = oldPromiseCache[key].refCount;
					promiseStore[key].url = oldPromiseCache[key].url;
					promiseStore[key].assetId = oldPromiseCache[key].assetId;
				}
			}
		} );
	}

	function getNewStaticDependencies( assetId, dependenciesToSet ) {
		var rtn,
			loader = findLoader( assetId ),
			dynamicDependencies = loader && loader.depend && loader.depend( assetId );

		if (dynamicDependencies) {
			rtn = [];
			dynamicDependencies = splitByComma( dynamicDependencies );
			dependenciesToSet = splitByComma( dependenciesToSet );
			for (var i = 0; i < dependenciesToSet.length; i++) {
				if (!dynamicDependencies.contains( dependenciesToSet[i] )) {
					rtn.push( dependenciesToSet[i] );
				}
			}
			return rtn.length ? rtn.join() : null;
		} else {
			return dependenciesToSet;
		}
	}

	function isDependenciesDifferent( dependencies1, dependencies2 ) {
		if ((dependencies1 && !dependencies2) ||
		    dependencies2 && !dependencies1) {
			return true;
		} else if (!dependencies1 && !dependencies2) {
			return false;
		}

		dependencies1 = splitByComma( dependencies1 ).sort();
		dependencies2 = splitByComma( dependencies2 ).sort();
		if (dependencies1.length != dependencies2.length) {
			return true;
		}

		for (var i = 0; i < dependencies1.length; i++) {
			if (dependencies1[i] != dependencies2[i]) {
				return true;
			}
		}

		return false;
	}

	function findLoader( assetId ) {
		var loaderName, i;
		for (i = loaderFinders.length - 1; i >= 0; i--) {
			loaderName = loaderFinders[i]( assetId );
			if (loaderName) {
				break;
			}
		}
		loaderName = loaderName || _loader.defaultLoader;
		return loaderStore[loaderName];
	}

	function attachFilter( filters, filterName ) {
		if (isString( filters[filterName] )) {
			filters[filterName] = commonLoadFilters[filterName][filters[filterName]];
		}
	}

	//#debug
	_loader.debug = {
		fullUrl: fullUrl,
		urlStore: urlStore,
		promiseStore: promiseStore,
		loaderStore: loaderStore,
		findLoader: findLoader,
		addHash: addHash,
		removeHash: removeHash,
		log: function( msg ) {
			var console = window.console;
			console && console.log && console.log( msg );
		},

		//this is for debugging purpose only
		moduleCounters: accessPromise,

		getLoaderByName: function( loaderName ) {
			return loaderName ? loaderStore[loaderName] : loaderStore;
		}
	};
	//#end_debug

	var

	//if yo have code like the following in javascript,
	//the part delete window.depend2 will be extracted
	// <@unload>
	//delete window.depend2;
	//</@unload>

		runloadStatement = /<@unload>([\w\W]+?)<\/@unload>/i,

	//match string "ref2, ref1" in
	// <@depend>
	//ref2, ref1
	//<@depend>
		rDependHeader = /<@depend>([\w\W]+?)<\/@depend>/i;

	//create a load function
	function resolveDependencies( actionAfterDependenciesResolved ) {
		return function( assetId ) {
			var defer = $.Deferred(),
				dependentResourceString = _loader.depend( assetId );

			if (dependentResourceString) {
				_loader.load( dependentResourceString ).done( function() {
					defer.resolve( assetId, actionAfterDependenciesResolved( assetId ) );
				} );
			} else {
				defer.resolve( assetId, actionAfterDependenciesResolved( assetId ) );
			}
			return defer.promise();
		};
	}

	//a special module which is a package of modules, like a container
	_loader( "pack", {
		load: resolveDependencies( $.noop ),
		url: "assetId"
	} );

	//js adapter try to parse the content of js file
	_loader( "js", {
		load: {
			staticLoaded: "hasScriptTag"
			//the following are commented out, because it is default value defined in convertLoadFiltersToLoadMethod
			//crossSiteLoad: "getScript",
			//getSource: "getTextByAjax",
			//compile: "globalEval",
			//buildDependencies: "parseDependTag",
			//buildUnload: "parseUnloadTag"
		},
		//this is necessary because if you have a sub loader inherits from
		//from this, and you don't want to inherited sub loader to specify this again
		fileExt: "js"
	} );

	_loader( "jsl", "js", {
		load: {
			compile: "localEval"
		}
	} );
	//loader is javascript file, it defines a loader
	_loader( "loader", "js", {
		url: "folder"
	} );

	//css adapter tries to parse the content of css file
	_loader( "css", {
		load: {
			staticLoaded: function( assetId ) {
				return !!($( "link" ).filter(
					function() {
						return removeHash( this.href ) === removeHash( _loader.url( assetId ) ) && !$( this ).attr( 'loadedByloader' );
					} ).length);
			},
			crossSiteLoad: function( assetId ) {
				var defer = $.Deferred();

				$( "<link href='" + _loader.url( assetId ) + "' " + "rel='stylesheet' type='text/css' loadedByloader='1' />" )
					.load( function() {
						defer.resolve( assetId );
					} )
					.appendTo( "head" );

				return defer.promise();
			},
			//explicitly specify that loader does not need a compile filter
			compile: null
		},

		unload: function( assetId ) {
			var url = fullUrl( _loader.url( assetId ) );
			$( "link" ).filter(
				function() {
					return this.href === url && $( this ).attr( 'loadedByloader' );
				} ).remove();
		},
		fileExt: "css"
	} );

	_loader( "image", {
		load: "cacheImage",
		noRefCount: true
	} );

	//make img linker can handle module with these file extension
	_loader.mapFileExtToLoader( "jpg,png,bmp,gif", "image" );
	//fred test

	//#merge
})( jQuery, hm );
//#end_merge
