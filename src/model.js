(function( $, window, undefined ) {
	"use strict";

	/*jshint smarttabs:true, evil:true, expr:true, newcap: false, validthis: true */
	/**
	 * a wrapper over a Node constructor,
	 * [value] is optional
	 */
	var hm = window.hm = function( path, value ) {
			return new Node( path, value );
		},
		Node = function( path, value ) {
			path = path || "";
			this.path = toPhysicalPath( path, true /* create shadow if necessary */ );
			if (!isUndefined( value )) {
				this.set( value );
			}
		},
		document = window.document,
		localStorage = window.localStorage,
		setTimeout = window.setTimeout,
		history = window.history,
		location = window.location,
		alert = window.alert,
		confirm = window.confirm,
		hmFn,
		extend = $.extend,
		repository = {},
		isArray = $.isArray,
		isFunction = $.isFunction,
		primitiveTypes = { 'undefined': undefined, 'boolean': undefined, 'number': undefined, 'string': undefined },
		shadowNamespace = "__hm",
		rShadowKey = /^__hm\.([^\.]+?)(?:\.|$)/,
	//try to match xxx in string this.get("xxx")
		rWatchedPath = /this\.(?:get)\s*\(\s*(['"])([\*\.\w\/]+)\1\s*\)/g,

	//key is watchedPaths
	//value is array of watchingPaths
		watchTable = {},
		defaultOptions = {},
		rootNode,
		shadowRoot = repository[shadowNamespace] = {},
		hasOwn = repository.hasOwnProperty,
		Array = window.Array,
		arrayPrototype = Array.prototype,
		stringPrototype = String.prototype,
		slice = arrayPrototype.slice,
		trigger,
		beforeUpdate = "beforeUpdate",
		afterUpdate = "afterUpdate",
		beforeCreate = "beforeCreate",
		afterCreate = "afterCreate",
		rJSON = /^(?:\{.*\}|\[.*\])$/,
		rUseParseContextAsContext = /^\.(\.*)([\.\*])/,
		rMainPath = /^\.<(.*)/,
		rBeginDotOrStar = /^[\.\*]/,
		rDotStar = /[\.\*]/,
		rHashOrDot = /#+|\./g,
		rHash = /#+/g,
		RegExp = window.RegExp,
		rParentKey = /^(.+)[\.\*]\w+$/,
		mergePath,
		rIndex = /^.+\.(\w+)$|\w+/,
		util,
		isUndefined,
		isPrimitive,
		isString,
		isObject,
		isBoolean,
		isNumeric = $.isNumeric,
		isPromise,
		toTypedValue,
		toPhysicalPath,
		toLogicalPath,
		clearObj,
		$fn = $.fn,
		clone,
		rSupplant = /\{([^\{\}]*)\}/g;

	//#debug
	//if you are using debug version of the library
	//you can use debugging facilities provided here
	//they are also used in unit test to test some internal variable which is
	//not exposed in production version
	//In debug version, you can turn on logging by setting hm.debug.enableLog = true
	//and turn on debugger by setting hm.debug.enableDebugger = true
	//
	//In production version, there is no logging or debugger facilities
	hm.debug = {};
	hm.debug.enableLog = true;
	hm.debug.enableDebugger = false;

	window.log = window.log || function() {
		if (hm.debug.enableLog && window.console) {
			console.log( Array.prototype.slice.call( arguments ) );
		}
	};
	//#end_debug

	//#merge
	trigger = function( currentTargetPath, targetPath, eventType, proposed, removed ) {
		return {
			hasError: function() {
				return false;
			}
		};
	};

	hm._setTrigger = function( fn ) {
		trigger = fn;
	};
	//#end_merge

	function augment( prototype, extension ) {
		for (var key in extension) {
			if (!prototype[key]) {
				prototype[key] = extension[key];
			}
		}
	}

	augment( arrayPrototype, {
		indexOf: function( obj, start ) {
			for (var i = (start || 0); i < this.length; i++) {
				if (this[i] == obj) {
					return i;
				}
			}
			return -1;
		},

		contains: function( item ) {
			return (this.indexOf( item ) !== -1);
		},

		remove: function( item ) {
			var position = this.indexOf( item );
			if (position != -1) {
				this.splice( position, 1 );
			}
			return this;
		},

		removeAt: function( index ) {
			this.splice( index, 1 );
			return this;
		},

		pushUnique: function( item ) {
			if (!this.contains( item )) {
				this.push( item );
			}
			return this;
		},

		merge: function( items ) {
			if (items && items.length) {
				for (var i = 0; i < items.length; i++) {
					this.pushUnique( items[i] );
				}
			}
			return this;
		},
		//it can be sortObject()
		//sortObject(by)
		sortObject: function( by, asc ) {
			if (isUndefined( asc )) {
				if (isUndefined( by )) {
					asc = true;
					by = undefined;
				} else {
					if (isString( by )) {
						asc = true;
					} else {
						asc = by;
						by = undefined;
					}
				}
			}

			if (by) {
				this.sort( function( a, b ) {
					var av = a[by];
					var bv = b[by];
					if (av == bv) {
						return 0;
					}
					return  asc ? (av > bv) ? 1 : -1 :
						(av > bv) ? -1 : 1;
				} );
			} else {
				asc ? this.sort() : this.sort().reverse();
			}
			return this;
		}
	} );

	augment( stringPrototype, {
		startsWith: function( text ) {
			return this.indexOf( text ) === 0;
		},
		contains: function( text ) {
			return this.indexOf( text ) !== -1;
		},
		endsWith: function( suffix ) {
			return this.indexOf( suffix, this.length - suffix.length ) !== -1;
		},
		supplant: function( obj ) {
			return this.replace( rSupplant,
				function( a, b ) {
					var r = obj[b];
					return typeof r ? r : a;
				} );
		},
		format: function() {
			var source = this;
			$.each( arguments, function( index, value ) {
				source = source.replace( new RegExp( "\\{" + index + "\\}", "g" ), value );
			} );
			return source;
		}
	} );

	hmFn = Node.prototype = hm.fn = hm.prototype = {

		constructor: Node,

		toString: function() {
			return this.path;
		},

		//get()
		//get(true)
		//
		//subPath can be null, undefined, "", or "any string"
		//get(subPath)
		//get(subPath, p1, p2)
		//
		//does not support the following, as will be implemented as get((subPath = p1), p2)
		//get(p1, p2)
		get: function( subPath /*, p1, p2, .. for parameters of model functions*/ ) {

			var currentValue, accessor = this.accessor( subPath, true );

			if (accessor) {

				if (isFunction( accessor.hostObj )) {

					return accessor.hostObj.apply( this.cd( ".." ), slice.call( arguments ) );

				}
				else {

					currentValue = !accessor.index ?
						accessor.hostObj :
						accessor.hostObj[accessor.index];

					if (isFunction( currentValue )) {

						//inside the function, "this" refer the parent model of accessor.physicalPath
						return currentValue.apply( this.cd( subPath ).cd( ".." ), slice.call( arguments, 1 ) );

					} else {

						return currentValue;
					}
				}
			}
			//else return undefined
		},

		getJson: function() {
			return JSON.stringify( this.get.apply( this, slice.call( arguments ) ) );
		},

		raw: function( subPath, value ) {
			var accessor;
			if (isFunction( subPath )) {
				value = subPath;
				subPath = "";
			}
			if (!value) {
				accessor = this.accessor( subPath, true );
				if (accessor) {
					return !accessor.index ?
						accessor.hostObj :
						accessor.hostObj[accessor.index];
				}
			} else {
				accessor = this.accessor( subPath );
				return ( accessor.index in accessor.hostObj ) ?
					this.update( subPath, value, accessor ) :
					this.create( subPath, value, accessor );
			}

		},

		//return node
		//you can use node.set to call the function at the path
		//the function context is bound to current proxy's parent
		//what is different for get function is that, set will return a proxy
		//and get will return the result of the function
		set: function( force, subPath, value ) {
			//allow set(path, undefined)
			if (arguments.length == 1) {
				if (this.path === "") {
					throw "root object can not changed";
				} else {
					rootNode.set( this.path, force, subPath );
					return this;
				}
			}

			var args = slice.call( arguments );

			if (!isBoolean( force )) {
				value = subPath;
				subPath = force;
				force = false;
			} else if (arguments.length == 2) {
				rootNode.set( force, this.path, subPath );
				return this;
			}

			var accessor = this.accessor( subPath );
			var currentValue = accessor.hostObj[accessor.index];

			if (isFunction( currentValue )) {

				//inside the function, "this" refer the parent model of accessor.physicalPath
				currentValue.apply( this.cd( subPath ).cd( ".." ), slice.call( args, 1 ) );
				return this;

			} else {

				return ( accessor.index in accessor.hostObj ) ?
					this.update( force, subPath, value, accessor ) :
					this.create( force, subPath, value, accessor );

			}
		},

		accessor: function( subPath, readOnly /*internal use only*/ ) {
			//if it is not readOnly, and access out of boundary, it will throw exception
			if (subPath === 0) {
				subPath = "0";
			}

			var i,
				index,
			//the hostObj start from root
				hostObj = repository,
			//the fullPath can be logicalPath , for example hm("person").getPath("*");
			//it can also be a physicalPath like hm("person*").getPath();
				fullPath = this.getPath( subPath ),
			//make sure we are working on a physicalPath
				physicalPath = toPhysicalPath( fullPath, true /*create shadow if necessary*/ ),
				parts = physicalPath.split( "." );

			if (parts.length === 1) {

				index = physicalPath;

			} else {

				//index is the last part
				index = parts[parts.length - 1];

				//traverse to the second last node in the parts hierarchy
				for (i = 0; i < parts.length - 1; i++) {
					hostObj = hostObj[parts[i]];
					if (hostObj === undefined) {
						break;
					}
				}
			}

			if (isPrimitive( hostObj )) {
				if (readOnly) {
					return;
				}
				else {
					throw "invalid update on unreachable node '" + toLogicalPath( fullPath ) + "'";
				}
			}

			return {
				physicalPath: physicalPath,
				hostObj: hostObj,
				index: index
			};
		},

		create: function( force, subPath, value, accessor /* accessor is used internally */ ) {

			if (!isBoolean( force )) {
				accessor = value;
				value = subPath;
				subPath = force;
				force = false;
			}

			accessor = accessor || this.accessor( subPath );

			var physicalPath = accessor.physicalPath;

			var hostObj = accessor.hostObj,
				index = accessor.index,
				isHostObjArray = isArray( hostObj );

			if (isHostObjArray && isNumeric( index )) {
				if (index > hostObj.length) {
					throw "you can not add item with hole in array";
				}
			} else {
				if (index in hostObj) {
					throw "value at path: '" + toLogicalPath( accessor.physicalPath ) + "' has been defined, " +
					      "try use update method instead";
				}
			}

			if (!force && trigger( physicalPath, physicalPath, beforeCreate, value ).hasError()) {
				return false;
			}

			if (isHostObjArray && isNumeric( index )) {
				if (index == hostObj.length) {
					hostObj[index] = value;

				} else if (index < hostObj.length) {
					//insert an item x into array [ 1, 2, 3] at position 2,
					// and it becomes [1, x, 2, 3]
					hostObj.splice( accessor.index, 0, value );
				}

			} else {
				hostObj[accessor.index] = value;
			}

			traverseModel( physicalPath, value );
			trigger( physicalPath, physicalPath, afterCreate, value );
			return this;
		},

		extend: function( subPath, object ) {
			var newModel;
			if (!object) {
				object = subPath;
				newModel = this;
			} else {
				newModel = this.cd( subPath );
			}
			for (var key in object) {
				newModel.set( key, object[key] );
			}
			return this;
		},

		/* accessor is used internally */
		//update(value)
		//update(subPath, value)
		//most of the time force is not used, by default is it is false
		//by in case you want to bypass validation you can explicitly set to true
		update: function( force, subPath, value, accessor ) {

			if (arguments.length == 1) {
				if (this.path === "") {
					throw "root object can not updated";
				} else {
					rootNode.update( this.path, force );
					return this;
				}
			}

			if (!isBoolean( force )) {
				accessor = value;
				value = subPath;
				subPath = force;
				force = false;
			} else if (arguments.length == 2) {
				rootNode.update( force, this.path, subPath );
				return this;
			}

			accessor = accessor || this.accessor( subPath );

			if (!( accessor.index in accessor.hostObj )) {
				throw "value at path: '" + toLogicalPath( accessor.physicalPath ) + "' has been not defined, " +
				      "try use create method instead";
			}

			var physicalPath = accessor.physicalPath;

			var originalValue = accessor.hostObj[accessor.index];
			//use "==" is purposeful, we want it to be flexible.
			// If model value is null, and textBox value is "", because null == "",
			// so that "" can not be set, same for "9" and 9
			if (originalValue == value) {
				return this;
			}

			if (!force && trigger( physicalPath, physicalPath, beforeUpdate, value, originalValue ).hasError()) {
				return false;
			}

			accessor.hostObj[accessor.index] = value;

			traverseModel( physicalPath, value );

			if (!force) {
				trigger( physicalPath, physicalPath, afterUpdate, value, originalValue );
			}

			return this;
		},

		del: function( subPath ) {
			if (isUndefined( subPath )) {
				if (this.path) {
					return rootNode.del( this.path );
				}
				throw "root can not be deleted";
			}

			var accessor = this.accessor( subPath ),
				hostObj = accessor.hostObj,
				physicalPath = accessor.physicalPath,
				removedValue = hostObj[accessor.index],
				isHostObjectArray = isArray( hostObj );

			if (trigger( physicalPath, physicalPath, "beforeDel", undefined, removedValue ).hasError()) {
				return false;
			}

			trigger( physicalPath, physicalPath, "duringDel", undefined, removedValue );

			if (isHostObjectArray) {

				hostObj.splice( accessor.index, 1 );

			} else {

				delete hostObj[accessor.index];

			}

			for (var i = 0; i < onDeleteHandlers.length; i++) {
				onDeleteHandlers[i]( physicalPath, removedValue );
			}

			trigger( physicalPath, physicalPath, "afterDel", undefined, removedValue );
			return removedValue;
		},

		createIfUndefined: function( subPath, value ) {
			if (isUndefined( value )) {
				throw "missing value argument";
			}
			var accessor = this.accessor( subPath );
			return ( accessor.index in accessor.hostObj ) ?
				this :
				this.create( subPath, value, accessor );
		},

		toggle: function( subPath ) {

			var accessor = this.accessor( subPath );
			if (accessor.index in accessor.hostObj) {
				this.update( subPath, !accessor.hostObj[accessor.index], accessor );
			}
			return this;
		},

		//navigation methods
		pushStack: function( newNode ) {
			newNode.previous = this;
			return newNode;
		},

		cd: function( relativePath ) {
			return this.pushStack( hm( this.getPath( relativePath ) ) );
		},

		parent: function() {
			return this.cd( ".." );
		},

		shadow: function() {
			return this.cd( "*" );
		},

		sibling: function( path ) {
			return this.cd( ".." + path );
		},

		main: function() {

			return this.pushStack( hm( getMainPath( this.path ) ) );
		},

		//--------------path methods---------------
		getPath: function( subPath ) {
			//join the context and subPath together, but it is still a logical path
			return mergePath( this.path, subPath );
		},

		//to get the logicalPath of current model, leave subPath empty
		logicalPath: function( subPath ) {
			return toLogicalPath( this.getPath( subPath ) );
		},

		//to get the physicalPath of current model, leave subPath empty
		physicalPath: function( subPath ) {
			return toPhysicalPath( this.getPath( subPath ) );
		},

		pathContext: function() {
			return contextOfPath( this.path );
		},

		pathIndex: function() {
			return indexOfPath( this.path );
		},

		//call the native method of the wrapped value
		invokeUnwrapped: function( methodName /*, p1, p2, ...*/ ) {
			if (arguments.length === 0) {
				throw "methodName is missing";
			}

			var context = this.get();
			return context[methodName].apply( context, slice.call( arguments, 1 ) );
		},

		//region array methods
		indexOf: function( item ) {
			return this.get().indexOf( item );
		},

		contains: function( item ) {
			return (this.indexOf( item ) !== -1);
		},

		first: function( fn ) {
			return fn ? this.filter( fn )[0] : this.get( "0" );
		},

		last: function() {
			var value = this.get();
			return value[value.length - 1];
		},

		push: function( item ) {
			for (var i = 0; i < arguments.length; i++) {
				this.create( this.get().length, arguments[i] );
			}
			return this;
		},

		pushUnique: function( item ) {
			return !this.contains( item ) ?
				this.push( item ) :
				this;
		},

		pop: function() {
			return this.removeAt( this.get().length - 1 );
		},

		shift: function() {
			return this.del( 0 );
		},

		unshift: function( item ) {
			return this.create( 0, item );
		},

		insertAt: function( index, item ) {
			return this.create( index, item );
		},

		updateAt: function( index, item ) {
			return this.update( index, item );
		},

		removeAt: function( index ) {
			return this.del( index );
		},

		move: function( fromIndex, toIndex ) {
			var count = this.count();

			if (fromIndex !== toIndex &&
			    fromIndex >= 0 && fromIndex < count &&
			    toIndex >= 0 && toIndex < count) {

				var item = this.del( fromIndex );
				this.insertAt( toIndex, item );
				trigger( this.path, this.path, "move", toIndex, fromIndex );
			}
			return this;
		},

		replaceItem: function( oldItem, newItem ) {
			if (oldItem == newItem) {
				return this;
			}

			var index = this.indexOf( oldItem );

			if (index != -1) {
				return this.updateAt( index, newItem );
			}
			return this;
		},

		removeItem: function( item ) {
			var index = this.indexOf( item );
			return index !== -1 ? this.removeAt( index ) : this;
		},

		removeItems: function( items ) {
			for (var i = 0; i < items.length; i++) {
				this.removeItem( items[i] );
			}
			return this;
		},

		clear: function() {
			var items = this.get(),
				oldItems = items.splice( 0, items.length );

			trigger( this.path, this.path, "afterCreate", items, oldItems );
			return this;
		},

		count: function() {
			return this.get().length;
		},

		//fn is like function (index, item) { return item == 1; };
		filter: function( fn ) {
			return $( this.get() ).filter( fn ).get();
		},

		//fn: function (index, item, items) {}
		each: function( directAccess, fn ) {
			if (!isBoolean( directAccess )) {
				fn = directAccess;
				directAccess = false;
			}

			var hasChange, i, status, items, itemModel;

			if (directAccess) {

				items = this.get();

				for (i = items.length - 1; i >= 0; i--) {
					//this in the fn refer to the parent array
					status = fn.call( items[i], i, items[i], items );
					if (status === true) {
						hasChange = true;
					} else if (status === false) {
						break;
					}
				}

				if (hasChange) {
					this.change();
				}

			} else {
				for (i = this.count() - 1; i >= 0; i--) {
					//this in the fn, refer to the parent model
					itemModel = this.cd( i );
					if (fn.call( itemModel, i, itemModel, this ) === false) {
						break;
					}
				}
			}
			return this;
		},

		map: function( fn ) {
			return $.map( this.get(), fn );
		},

		sort: function( by, asc ) {
			return trigger( this.path, this.path, "afterUpdate", this.get().sortObject( by, asc ) );
		},
		//#endregion

		//-------model watch method -----------
		watch: function( /*targetPath1, targetPath2, ..*/ ) {
			for (var i = 0; i < arguments.length; i++) {
				watch( this.path, arguments[i] );
			}
			return this;
		},

		unwatch: function( /*targetPath1, targetPath2, ..*/ ) {
			for (var i = 0; i < arguments.length; i++) {
				unwatch( this.path, arguments[i] );
			}
			return this;
		},

		//endregion

		//-------other methods---------
		isEmpty: function( subPath ) {
			var value = this.get( subPath );
			return !value ? true :
				!isArray( value ) ? false :
					(value.length === 0);
		},

		isShadow: function() {
			return this.path.startsWith( shadowNamespace );
		},

		toJSON: function( subPath ) {
			return JSON.stringify( this.get( subPath ) );
		},

		compare: function( expression ) {
			if (expression) {
				expression = toTypedValue( expression );
				if (isString( expression )) {
					if (this.get() == expression) {
						return true;
					} else {
						try {
							return eval( "this.get()" + expression );
						} catch (e) {
							return false;
						}
					}
				} else {
					return this.get() == expression;
				}
			} else {
				return this.isEmpty();
			}
		},

		saveLocal: function( subPath ) {
			util.local( this.getPath( subPath ), this.get( subPath ) );
			return this;
		},

		getLocal: function( subPath ) {
			return util.local( this.getPath( subPath ) );
		},

		restoreLocal: function( subPath ) {
			rootNode.set( this.getPath( subPath ), this.getLocal( subPath ) );
			return this;
		},

		clearLocal: function( subPath ) {
			util.local( this.getPath( subPath ), undefined );
			return this;
		}

	};

	function expandToHashes( $0 ) {
		return $0 === "." ? "#" : //if it is "." convert to "#"
			new Array( $0.length + 2 ).join( "#" ); ////if it is "#" convert to "##"
	}

	var onAddOrUpdateHandlers = [function /*inferNodeDependencies*/ ( context, index, value ) {

		//only try to parse function body
		//if it is a parameter-less function
		//or it has a magic function name "_"
		if (!isFunction( value ) || (value.name && value.name.startsWith( "_" ))) {
			return;
		}

		var functionBody = value.toString(),
			path = context ? context + "." + index : index,
			watchedPaths = extractWatchedPaths( functionBody );

		for (var i = 0; i < watchedPaths.length; i++) {
			watch( path, context ? mergePath( context, watchedPaths[i] ) : watchedPaths[i] );
		}
	}];

	function processNewNode( contextPath, indexPath, modelValue ) {
		for (var i = 0; i < onAddOrUpdateHandlers.length; i++) {
			onAddOrUpdateHandlers[i]( contextPath, indexPath, modelValue );
		}
	}

	function getMainPath( shadowPath ) {
		if (shadowPath === shadowNamespace) {
			return "";
		}
		var match = rShadowKey.exec( shadowPath );
		return match ? convertShadowKeyToMainPath( match[1] ) : shadowPath;
	}

	function convertShadowKeyToMainPath( key ) {
		return key.replace( rHash, reduceToDot );
	}

	function reduceToDot( hashes ) {
		return hashes == "#" ? "." : // if is # return .
			new Array( hashes.length ).join( "#" ); // if it is ## return #
	}

	/* processCurrent is used internally, don't use it */
	function traverseModel( modelPath, modelValue, processCurrent ) {
		var contextPath,
			indexPath,
			indexOfLastDot = modelPath.lastIndexOf( "." );

		if (isUndefined( processCurrent )) {
			processCurrent = true;
		}

		if (processCurrent) {

			if (indexOfLastDot === -1) {
				contextPath = "";
				indexPath = modelPath;
			} else {
				contextPath = modelPath.substring( 0, indexOfLastDot );
				indexPath = modelPath.substring( indexOfLastDot + 1 );
			}

			processNewNode( contextPath, indexPath, modelValue );
		}

		if (!isPrimitive( modelValue )) {

			for (indexPath in modelValue) {

				//do not remove the hasOwnProperty check!!
				//if (hasOwn.call( modelValue, index )) {
				processNewNode( modelPath, indexPath, modelValue[indexPath] );
				traverseModel( modelPath + "." + indexPath, modelValue[indexPath], false );
				//}
			}
		}
	}

	function watch( watchingPath, watchedPath ) {
		watchedPath = toPhysicalPath( watchedPath );
		var referencingPaths = watchTable[watchedPath];
		if (!referencingPaths) {
			watchTable[watchedPath] = referencingPaths = [];
		}
		referencingPaths.pushUnique( watchingPath );
	}

	function unwatch( watchingPath, watchedPath ) {
		watchedPath = toPhysicalPath( watchedPath );
		var watchingPaths = watchTable[watchedPath];
		watchingPaths.remove( watchingPath );
		if (!watchingPaths.length) {
			delete watchTable[watchedPath];
		}
	}

	function extractWatchedPaths( functionBody ) {
		var memberMatch,
			rtn = [];

		while ((memberMatch = rWatchedPath.exec( functionBody ) )) {
			rtn.pushUnique( memberMatch[2] );
		}
		return rtn;
	}

	function contextOfPath( path ) {
		var match = rParentKey.exec( path );
		return match && match[1] || "";
	}

	function indexOfPath( path ) {
		var match = rIndex.exec( path );
		return match[1] || match[0];
	}

	var dummy = {};

	var Class = function _( seed ) {
		var temp;

		if (!(this instanceof _)) {
			temp = new _( dummy );
			return _.apply( temp, arguments );
		}

		if (arguments[0] === dummy) {
			return this;
		}

		this.initialize.apply( this, arguments );
		return this;
	};

	var superPrototype;
	extend( Class.prototype, {

		callProto: function( methodName ) {
			var method = this.constructor.prototype[methodName];
			return method.apply( this, slice.call( arguments, 1 ) );
		},

		//instance.callBase("method1", p1, p2,...);
		callBase: function( methodName ) {
			//superPrototype is global object, we use this
			// because assume js in browser is a single threaded

			//starting from "this" instance
			superPrototype = superPrototype || this;
			superPrototype = superPrototype.constructor.__super__;

			if (!superPrototype) {
				return;
			}

			var method = superPrototype[methodName];
			var rtn = method.apply( this, slice.call( arguments, 1 ) );

			//when it done, set it back to null
			superPrototype = null;
			return rtn;
		},

		/* the subType's initialize should be like
		 *
		 initialize: function( seed ) {
		 //do things
		 this.callBase( "initialize", seed );
		 },
		 */
		//the default initialize is to extend the instance with seed data
		initialize: function( seed ) {
			extend( this, seed );
		},

		//this function will be called when JSON.stringify() is called
		toJSON: function() {
			var rtn = extend( true, {}, this );

			for (var key in rtn) {
				if (key.startsWith( "__" )) {
					delete rtn[key];
				}
			}
			return rtn;
		}

	} );

	extend( Class, {

		//create an array of items of the same type
		//if You have a subType called Person
		//you can Person.list([ seed1, seed2 ]);
		//to create an array of typed items
		list: function( seeds ) {

			var i,
				seed,
				rtn = [],
				itemIsObject;

			if (isUndefined( seeds )) {

				return rtn;

			} else {

				if (!isArray( seeds )) {

					seeds = slice.call( arguments );

				}

				itemIsObject = seeds.itemIsObject;

				for (i = 0; i < seeds.length; i++) {
					seed = seeds[i];

					rtn.push(
						itemIsObject || !isArray( seed ) ?
							seeds instanceof this ? this : new this( seed ) :
							this.apply( null, seed )
					);
				}

			}

			return rtn;
		},

		//to create a new Type call

		extend: function( instanceMembers, staticMembers ) {
			var Child,
				Parent = this;

			// The constructor function for the new subclass is either defined by you
			// (the "constructor" property in your `extend` definition), or defaulted
			// by us to simply call the parent's constructor.
			if (instanceMembers && instanceMembers.hasOwnProperty( "constructor" )) {
				Child = instanceMembers.constructor;
			} else {
				Child = function _() {
					var temp;

					if (!(this instanceof _)) {
						temp = new _( dummy );
						return _.apply( temp, arguments );
					}

					if (arguments[0] === dummy) {
						return this;
					}
					//this is similar like : base(arguments)
					Parent.apply( this, arguments );
					return this;
				};
			}

			// Add static properties to the constructor function, if supplied.
			extend( Child, Parent, staticMembers );

			// Set the prototype chain to inherit from `parent`, without calling
			// `parent`'s constructor function.
			var Surrogate = function() { this.constructor = Child; };
			Surrogate.prototype = Parent.prototype;
			Child.prototype = new Surrogate();

			// Add prototype properties (instance properties) to the subclass,
			// if supplied.
			if (instanceMembers) {
				extend( Child.prototype, instanceMembers );
			}

			// Set a convenience property in case the parent's prototype is needed
			// later.
			Child.__super__ = Parent.prototype;

			return Child;
		}

	} );

	//helpers
	extend( hm, {

		Class: Class,

		util: util = {

			//user do not need to use createShadowIfNecessary parameter
			//it is for internal use
			//it is only used in two places. It is, when a model is created
			// and when accessor is build,
			// even in these two case when the parameter is true,
			// shadow is not necessary created
			// it is only created when
			// the the physical path is pointing to a shadow
			// and the main model has been created
			// and the shadow's parent is an object
			toPhysicalPath: toPhysicalPath = function( logicalPath, createShadowIfNecessary /* internal use*/ ) {

				var match, rtn = "", leftContext = "", mainValue, shadowKey, mainPath;

				while ((match = rDotStar.exec( logicalPath ))) {
					//reset logical Path to the remaining of the search text
					logicalPath = RegExp.rightContext;
					leftContext = RegExp.leftContext;

					if (match[0] == ".") {

						if (rtn) {
							//mainPath = rtn + "." + leftContext
							if (rtn == shadowNamespace && createShadowIfNecessary && !shadowRoot[leftContext]) {
								mainPath = convertShadowKeyToMainPath( leftContext );
								if (!isUndefined( rootNode.get( mainPath ) )) {
									shadowRoot[leftContext] = {};
								}
								//!isUndefined( rootNode.get( mainPath ) )
								/*	if (createShadowIfNecessary &&
								 !shadowRoot[shadowKey] &&
								 rtn != shadowNamespace &&
								 !isUndefined( mainValue = rootNode.get( mainPath ) )) {
								 */
							}
							rtn = rtn + "." + leftContext;
							//shadowRoot[shadowKey]
							//if (rtn ==)
						} else {
							rtn = leftContext;
						}

					} else {

						//if match is "*", then it is shadow
						//if rtn is not empty so far
						if (rtn) {
							//shadowKey will be
							//convertMainPathToShadowKey
							shadowKey = ( rtn ? rtn.replace( rHashOrDot, expandToHashes ) : rtn) + "#" + leftContext;
							mainPath = rtn + "." + leftContext;
						} else {
							if (leftContext) {
								shadowKey = leftContext;
								mainPath = leftContext;

							} else {

								shadowKey = "";
								mainPath = "";
							}
						}

						rtn = shadowNamespace + (shadowKey ? "." + shadowKey : "");

						//only when main model exists , and host of the object exists
						//then create shadow
						if (createShadowIfNecessary && !shadowRoot[shadowKey] &&
						    rtn != shadowNamespace && !isUndefined( mainValue = rootNode.get( mainPath ) )) {

							shadowRoot[shadowKey] = {};
						}
					}
				}

				return !logicalPath ? rtn :
					rtn ? rtn + "." + logicalPath :
						logicalPath;
			},
			toLogicalPath: toLogicalPath = function( physicalPath ) {

				var index, logicalPath, mainPath, match;

				if (physicalPath === shadowNamespace) {
					return "*";
				}

				match = rShadowKey.exec( physicalPath );
				if (match) {
					// if physical path is like __hm.key.x
					// convert the key path into mainPath
					index = RegExp.rightContext;
					mainPath = convertShadowKeyToMainPath( match[1] );
					logicalPath = mainPath + "*" + index;
					return toLogicalPath( logicalPath );

				} else {

					return physicalPath;
				}

			},

			/*join the context and subPath together, if path is not necessary the same as logical path
			 *convertSubPathToRelativePath by default is true, so that if you specify subPath as "b"
			 * and  context is "a", it will be merged to "a.b" . If explicitly specify
			 * convertSubPathToRelativePath to false, they will not be merged, so the "b" will be
			 * returned as merge path*/
			mergePath: mergePath = function( contextPath, subPath, convertSubPathToRelativePath
			                                 /*used internally*/ ) {
				if (subPath == "_") {

					return "_";

				} else if (contextPath == "_") {

					if (subPath && subPath.startsWith( "/" )) {

						contextPath = "";

					} else {

						return "_";
					}
				}

				contextPath = toPhysicalPath( contextPath );

				var match;
				if (!isUndefined( subPath ) && subPath !== null) {
					subPath = subPath + "";
					if (subPath.startsWith( "/" )) {
						return subPath.substr( 1 );
					}
				}
				if (isUndefined( convertSubPathToRelativePath )) {
					convertSubPathToRelativePath = true;
				}

				if (convertSubPathToRelativePath && subPath && contextPath && !rBeginDotOrStar.test( subPath )) {
					subPath = "." + subPath;
				}

				if (!subPath || subPath == ".") {

					return contextPath;

				} else if (!rBeginDotOrStar.test( subPath )) {

					return subPath;

				} else if ((match = rUseParseContextAsContext.exec( subPath ))) {
					//if subPath is like ..xyz or .*xyz
					var stepsToGoUp = 1 + (match[1] ? match[1].length : 0),
						remaining = RegExp.rightContext,
						mergedContext = contextPath;

					while (stepsToGoUp) {
						mergedContext = contextOfPath( mergedContext );
						stepsToGoUp--;
					}

					//use rule's context as context
					//.. or .*
					//$2 is either "." or "*"
					return remaining ?
						(mergedContext ? mergedContext + match[2] + remaining : remaining) :
						(match[2] === "*" ? mergedContext + "*" : mergedContext);

					//if subPath is like .ab or *ab
				} else if ((match = rMainPath.exec( subPath ))) {

					return mergePath( getMainPath( contextPath ), match[1] );

				}
				return contextPath + subPath;
			},

			isUndefined: isUndefined = function( obj ) {
				return (obj === undefined);
			},
			isPrimitive: isPrimitive = function( obj ) {
				return (obj === null ) || (typeof(obj) in primitiveTypes);
			},
			isString: isString = function( val ) {
				return typeof val === "string";
			},
			isObject: isObject = function( val ) {
				return $.type( val ) === "object";
			},
			isBoolean: isBoolean = function( object ) {
				return typeof object === "boolean";
			},
			toTypedValue: toTypedValue = function( stringValue ) {
				if (isString( stringValue )) {
					stringValue = $.trim( stringValue );
					try {
						stringValue = stringValue === "true" ? true :
							stringValue === "false" ? false :
								stringValue === "null" ? null :
									stringValue === "undefined" ? undefined :
										isNumeric( stringValue ) ? parseFloat( stringValue ) :
											//Date.parse( stringValue ) ? new Date( stringValue ) :
											rJSON.test( stringValue ) ? $.parseJSON( stringValue ) :
												stringValue;
					} catch (e) {}
				}
				return stringValue;
			},
			isPromise: isPromise = function( object ) {
				return !!(object && object.promise && object.done && object.fail);
			},
			clearObj: clearObj = function( obj ) {
				if (isPrimitive( obj )) {
					return null;
				}
				for (var key in obj) {
					if (hasOwn.call( obj, key )) {
						obj[key] = clearObj( obj[key] );
					}
				}
				return obj;
			},
			clone: clone = function( original, deepClone ) {
				return isPrimitive( original ) ? original :
					isArray( original ) ? original.slice( 0 ) :
						isFunction( original ) ? original :
							extend( !!deepClone, {}, original );
			},

			local: function( key, value ) {
				if (arguments.length == 1) {
					return JSON.parse( localStorage.getItem( key ) );
				} else {
					if (isUndefined( value )) {
						localStorage.removeItem( key );
					} else {
						localStorage.setItem( key, JSON.stringify( value ) );
					}
				}
			},

			toString: function( value ) {
				return (value === null || value === undefined) ? "" : "" + value;
			},

			//#debug
			_referenceTable: watchTable,
			//#end_debug

			encodeHtml: function( str ) {
				var div = document.createElement( 'div' );
				div.appendChild( document.createTextNode( str ) );
				return div.innerHTML;
			}

		},

		//this is used to process the new node added to repository
		onAddOrUpdateNode: function( fn ) {
			if (fn) {
				onAddOrUpdateHandlers.push( fn );
				return this;
			} else {
				return onAddOrUpdateHandlers;
			}
		},

		onDeleteNode: function( fn ) {
			if (fn) {
				onDeleteHandlers.push( fn );
				return this;
			} else {
				return onDeleteHandlers;
			}
		},

		//use this for configure options
		options: defaultOptions
	} );

	var onDeleteHandlers = [
		function /*removeModelLinksAndShadows*/ ( physicalPath, removedValue ) {

			var watchedPath,
				mainPath,
				physicalPathOfShadow,
				logicalShadowPath,
				logicalPath = toLogicalPath( physicalPath );

			//remove modelLinks whose publisherPath == physicalPath
			for (watchedPath in watchTable) {
				unwatch( physicalPath, watchedPath );
			}

			//remove modelLinks whose subscriber == physicalPath
			for (watchedPath in watchTable) {
				if (watchedPath.startsWith( physicalPath )) {
					delete watchTable[watchedPath];
				}
			}

			//delete shadow objects,
			// which are under the direct shadow of main path
			for (mainPath in shadowRoot) {

				physicalPathOfShadow = shadowNamespace + "." + mainPath;
				logicalShadowPath = toLogicalPath( physicalPathOfShadow );

				if (logicalShadowPath == logicalPath ||
				    logicalShadowPath.startsWith( logicalPath + "*" ) ||
				    logicalShadowPath.startsWith( logicalPath + "." )) {
					rootNode.del( physicalPathOfShadow );
				}
			}
		}
	];

	$( "get,set,del,extend".split( "," ) ).each( function( index, value ) {
		hm[value] = function() {
			return rootNode[value].apply( rootNode, slice.call( arguments ) );
		};
	} );

	rootNode = hm();

	$fn.hmData = function( name, value ) {

		var data = this.data( "hmData" );

		if (arguments.length === 0) {

			return data;

		} else if (arguments.length === 1) {

			return data && data[name];

		} else {
			//arguments.length == 2
			if (isUndefined( data )) {
				this.data( "hmData", data = {} );
			}
			data[name] = value;
		}
	};

	/*	pathsWatching: function() {
	 var key, links, rtn = [], path = this.path;
	 for (key in modelLinks) {
	 links = modelLinks[key];
	 if (links.contains( path )) {
	 rtn.push( key );
	 }
	 }
	 return rtn;
	 },

	 ,*/

	//#debug

	hm.debug.watchingPaths = function me( watchedPath, deep ) {
		var rtn = watchTable[watchedPath] || [];
		if (deep) {
			for (var i = 0; i < rtn.length; i++) {
				rtn.merge( me( rtn[i], deep ) );
			}
		}
		return rtn;
	};

	hm.debug.watchedPaths = function( watchingPath ) {
		var key, links, rtn = [];
		for (key in watchTable) {
			links = watchTable[key];
			if (links.contains( watchingPath )) {
				rtn.push( key );
			}
		}
		return rtn;
	};

	hm.debug.shadowNamespace = shadowNamespace;
	hm.debug.extractWatchedPaths = extractWatchedPaths;
	hm.debug.removeAll = function() {
		for (var key in repository) {
			if (key !== shadowNamespace) {
				rootNode.del( key, true );
			}
		}
	};
	//#end_debug

	//#merge
})
	( jQuery, window );
//#end_merge