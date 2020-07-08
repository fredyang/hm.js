 /*!
  * Hm.js JavaScript Library v1.0.0
  * © Fred Yang - http://semanticsworks.com
  * License: MIT (http://www.opensource.org/licenses/mit-license.php)
  * Date: Tue Apr 1 19:15:50 2014 -0700
  */
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


//<@depends>model.js</@depends>



	var workflowStore,
		rSpaces = /[ ]+/,
		rEndWithStarDot = /\*\.$/,
		rDotOrStar = /\.|\*/g,
	//rOriginalEvent = /^(.+?)(\.\d+)?$/,
		subscriptionManager,
		viewId = 0,
		rInit = /init(\d*)/,
		workflow,
	//the handler string should be like
	// "get set convert finalize initialize"
		activityTypes = "get,set,convert,finalize,initialize".split( "," );

	function returnFalse() {
		return false;
	}

	function returnTrue() {
		return true;
	}

	function Event( publisher, originalPublisher, eventType, proposed, removed ) {
		this.publisher = tryWrapPublisherSubscriber( publisher );
		this.originalPublisher = tryWrapPublisherSubscriber( originalPublisher );
		this.type = eventType;
		this.originalType = eventType;
		this.proposed = proposed;
		this.removed = removed;
	}

	Event.prototype = {
		constructor: Event,

		/*	isOriginal: function() {
		 return this.publisher.path == this.originalPublisher.path;
		 },

		 isBubbleUp: function() {
		 return (this.publisher.path != this.originalPublisher.path) &&
		 (this.publisher.path.startsWith( this.originalPublisher.path ));
		 },*/
		isDependent: function() {
			return (!this.publisher.path.startsWith( this.originalPublisher.path ));
		},

		stopPropagation: function() {
			this.isPropagationStopped = returnTrue;
		},

		stopImmediatePropagation: function() {
			this.isImmediatePropagationStopped = returnTrue;
			this.isPropagationStopped = returnTrue;
			this.isCascadeStopped = returnTrue;
		},

		stopCascade: function() {
			this.isCascadeStopped = returnTrue;
		},

		error: function() {
			this.hasError = returnTrue;
		},

		abort: abort,
		isCascadeStopped: returnFalse,
		isPropagationStopped: returnFalse,
		isImmediatePropagationStopped: returnFalse,
		isAborted: returnFalse,
		hasError: returnFalse,
		level: 0
	};

	// raise model event,
	trigger = function( path, originalPath, eventType, proposed, removed ) {

		var e = new Event( path, originalPath, eventType, proposed, removed );

		//event can be changed inside the function
		callbackModelSubscriptionHandler( e );

		if (!e.isPropagationStopped() && e.publisher.path) {

			if (e.isDependent()) {
				//if is dependent event, the original event has been
				// bubbled up in its direct hierarchy
				//we need to change the hierarchy by setting the target
				e.originalPublisher.path = e.publisher.path;
			}

			//continue to the same instance of event object
			do {

				e.publisher.path = e.publisher.pathContext();
				e.level++;
				e.type = e.originalType + "." + e.level;
				callbackModelSubscriptionHandler( e );

			} while (!e.isPropagationStopped() && e.publisher.path);
		}

		//restore previous values
		e.type = eventType;
		e.originalPublisher.path = originalPath;
		e.publisher.path = path;
		return e;
	};


	subscriptionManager = (function() {

		var subscriptionStore = [ ];

		//target is either publisher or subscriber
		function canRemoveSubscriptionData( target, publisher, subscriber ) {
			if (target === publisher || target === subscriber) {
				return true;
			} else {
				//if target is model path
				if (isString( target )) {
					return ( isString( publisher ) && publisher.startsWith( target + "." )) ||
					       ( isString( subscriber ) && subscriber.startsWith( target + "." ));
				} else {
					return false;
				}
			}

		}

		function getSubscriptionsBy( target, match ) {
			if (isString( target )) {
				target = toPhysicalPath( target );
			}

			var rtn = [];
			for (var i = 0, item; i < subscriptionStore.length; i++) {
				item = subscriptionStore[i];
				if (match( item, target )) {
					rtn.push( item );
				}
			}
			return rtn;
		}

		return {

			//subscriptions whose publisher is the parameter
			//publisher can be a model path or dom element, or object
			getByPublisher: function( publisher ) {
				return getSubscriptionsBy( publisher, function( item, target ) {
					return item.publisher == target;
				} );
			},

			//subscriptions whose subscriber is the parameter
			//subscriber can be a model path or dom element, or object
			getBySubscriber: function( subscriber ) {
				return getSubscriptionsBy( subscriber, function( item, target ) {
					return item.subscriber == target;
				} );
			},

			//object can be a model path or dom element, or object
			getBy: function( subscriberOrPublisher ) {
				return getSubscriptionsBy( subscriberOrPublisher, function match( item, target ) {
					return item.subscriber == target || item.publisher == target;
				} );
			},

			getAll: function() {
				return subscriptionStore;
			},

			add: function( subscriber, publisher, eventTypes, handler ) {
				if (isString( publisher )) {

					var events = eventTypes.split( rSpaces );
					for (var i = 0; i < events.length; i++) {
						var special = this.special[events[i]];
						special && special.setup && special.setup( subscriber, publisher );
					}
				}

				subscriptionStore.push( {
					publisher: publisher,
					subscriber: subscriber,
					eventTypes: eventTypes,
					handler: handler
				} );
			},

			removeBy: function( subscriberOrPublisher ) {

				var i,
					j,
					special,
					subscription,
					handler,
					subscriptionsRemoved = [];

				for (i = subscriptionStore.length - 1; i >= 0; i--) {
					subscription = subscriptionStore[i];
					handler = subscription.handler;

					if (canRemoveSubscriptionData( subscriberOrPublisher, subscription.publisher, subscription.subscriber )) {

						//if publisher is an view object, need to unbind or undelegate
						//the jQuery event handler
						if (!isString( subscription.publisher )) {
							if (handler.delegateSelector) {
								$( subscription.publisher ).undelegate( handler.delegateSelector, subscription.eventTypes, viewHandlerGateway );

							} else {
								$( subscription.publisher ).unbind( subscription.eventTypes, viewHandlerGateway );
							}
						}

						subscriptionsRemoved.push( subscriptionStore.splice( i, 1 )[0] );
					}
				}

				for (i = subscriptionsRemoved.length - 1; i >= 0; i--) {
					subscription = subscriptionsRemoved[i];
					if (isString( subscription.publisher )) {
						var events = subscription.eventTypes.split( rSpaces );
						for (j = 0; j < events.length; j++) {
							special = this.special[events[j]];
							special && special.teardown && special.teardown( subscription.subscriber, subscription.publisher );
						}
					}
				}
			},

			special: {
				/*validityChanged: {
				 setup: function (publisher, subscriber) {},
				 teardown: function (publisher, subscriber) {}
				 }
				 */
			}

		};
	})();

	function getMember( e ) {

		var handler = e.handler,
			propertyName = handler.getName,
		//getSubProperty is used for properties like css, attr, prop
			subPropertyName = handler.getParas,
			publisher = e.publisher;

		return subPropertyName ? publisher[propertyName]( subPropertyName ) :
			isFunction( publisher[propertyName] ) ? publisher[propertyName]() :
				publisher[propertyName];
	}

	function setMember( value, e ) {
		var handler = e.handler,
			propertyName = handler.setName,
		//setSubProperty is used for properties like css, attr, prop
			subPropertyName = handler.setParas,
			subscriber = this;

		subPropertyName ? subscriber[propertyName]( subPropertyName, value ) :
			isFunction( subscriber[propertyName] ) ? subscriber[propertyName]( value ) :
				subscriber[propertyName] = value;
	}

	extend( hm, {

		//Event: Event,

		trigger: trigger,

		subscription: subscriptionManager,

		//handler can be a function (e) {}
		// a string like "get set convert int"
		//or "*get *set *convert *int"
		//or it can be "*commonHandler"
		//or it can be { get:xx, set:xx, convert:xx, initialize: xx}
		//it can be a javascript object, dom element, but it can not be a jQuery object
		//subscriber can be null, "_", "null", undefined to represent a case where there is not subscriber
		//if subscriber is "", it means the the root model, the repository object
		sub: function( subscriber, publisher, eventTypes, workflow, workflowOptions, delegateSelector ) {

			if (subscriber instanceof hm) {
				subscriber = subscriber.path;
			}

			if (publisher instanceof hm) {
				publisher = publisher.path;
			}

			if (isString( subscriber ) && subscriber.startsWith( "$" )) {
				subscriber = $( subscriber.substr( 1 ) );
			}

			if (subscriber && subscriber.jquery) {
				//subscriber is like $()
				//need to convert jQuery object into dom or raw element
				if (!subscriber.length && !subscriber.selector) {
					subscriber = null;
				} else {
					subscriber.each( function( index, element ) {
						//unwrap jQuery element
						hm.sub( element, publisher, eventTypes, workflow, workflowOptions, delegateSelector );
					} );
					return;
				}
			}

			if (isString( publisher ) && publisher.startsWith( "$" )) {
				publisher = $( publisher.substr( 1 ) );
			}

			if (publisher && publisher.jquery) {
				publisher.each( function( index, element ) {
					hm.sub( subscriber, element, eventTypes, workflow, workflowOptions, delegateSelector );
				} );
				return;
			}

			if (!publisher && publisher !== "") {
				throw "publisher can not be null";
			}

			if (!eventTypes) {
				throw "eventTypes can not be null";
			}

			//allow subscriber "", because this is the path of root model
			if (subscriber === "_" || subscriber == "null" || subscriber === null) {
				subscriber = undefined;
			}

			if (workflowOptions === "_") {
				workflowOptions = undefined;
			}

			var isPublisherModel = isString( publisher ),
				isSubscriberModel = isString( subscriber );

			viewIdManager.mark( publisher );
			viewIdManager.mark( subscriber );

			if (isPublisherModel) {
				//subscriber is a model
				publisher = toPhysicalPath( publisher );
			}

			if (isSubscriberModel) {
				//subscriber is a model
				subscriber = toPhysicalPath( subscriber );

			}

			if (isPublisherModel) {

				subscribeModelEvent( publisher, eventTypes, subscriber, workflow, workflowOptions );

			} else {

				subscribeViewEvent( publisher, eventTypes, subscriber, workflow, workflowOptions, delegateSelector );
			}
		},

		handle: function( /* publisher, eventTypes, workflow, workflowOptions, delegateSelector */ ) {
			return this.sub.apply( this, [null].concat( slice.call( arguments ) ) );
		},

		//a workflowPrototype can be a string like "get set convert initialize finalize"
		// or it can be an object
		/*
		 {
		 get: "xx" or function () {},
		 set: "xx" or function () {},
		 convert: "xx" or function () {},
		 initialize: "xx" or function () {},
		 finalize: "xx" or function () {}
		 }
		 */
		workflow: workflow = function( name, workflowPrototype ) {

			if (isObject( name )) {
				for (var key in name) {
					workflowStore[key] = buildWorkflow( name[key] );
				}
				return;
			}

			if (isUndefined( name )) {
				return workflowStore;
			}

			if (isUndefined( workflowPrototype )) {
				return workflowStore[name];
			}

			workflowStore[name] = buildWorkflow( workflowPrototype );
			return workflowStore[name];

		},
		//common getter and setter are special activity in they way they are used
		//other activities use the key directly to reference the activities
		// but getters and setters need to use "*key" to reference getters and setters
		// if your getter/setter key does not begin with "*", then it will use the defaultGet
		//or defaultSet, and they key will become the getProperty, and optionally,
		// use options to pass the getProp value, the defaultGet/defaultSet
		// are not meant to be used directly like other common getters or setters
		activity: {

			//initialize( publisher, subscriber, handler, workflowOptions );
			//inside initialize function, 'this' refer to the window
			initialize: {},

			//value = handler.get.apply( subscriber, [e].concat( triggerData ) );
			//inside the getter function, 'this' refer to the subscriber
			//get(e)
			get: {
				getMember: getMember,

				//the original get is "get" current
				//because of event bubbling, the default get method for model
				//will not return the value you want, so need to getOriginal
				getOriginal: function( e ) {
					return e.originalPublisher.get();
				},

				//if we want to call a member "foo" of publisher model
				//but we don't want to do anything to the subscriber, we may want to use expression
				//"*fakeGet foo"

				//$click:items|*editShadowItem
				//$click:items*queryResult|*editShadowItem
				//workflow(handler) -->newShadowItem: "*fakeGet newShadowItem",
				fakeGet: function() {
					return dummy;
				}
			},

			//handler.set.call( subscriber, value, e );
			//inside setter function 'this' refer to the subscriber
			//set(value, e)
			set: {
				setMember: setMember,

				//because hm.js want to support simplified activity expression
				//rule 1
				// "val", when publisher is view, subscriber is model, which means "val" view,
				//"set" model
				//rule 2
				//or "html", when publisher is model, subscriber is view, which means "get" model
				//"html" view.

				//so if publisher is model, subscriber is view. We just want to call a method "get"
				//on model which modify model, but we don't want to call any method on view.
				//we are in dilemma because of rule 2, we don't have a default method for a view.
				//a case in use is that
				//shadowEdit: "!init:.|initShadowEdit *fakeSet;" +
				fakeSet: $.noop

			},

			//handler.convert.call( subscriber, value, e );
			//inside converter function 'this' refer to subscriber
			convert: {

				toString: util.toString,

				toTypedValue: util.toTypedValue,

				toNumber: function( value ) {
					return +value;
				},

				toDate: function( value ) {
					return new Date( value );
				}
			},

			//handler.finalize.call( subscriber, value, e );
			//inside the afterSet function, 'this' refer to the subscriber
			finalize: {
				//				saveLocal: function( value, e ) {
				//					util.local( e.publisher.path, value );
				//				}
			}
		}
	} );

	workflowStore = {

		change: {
			get: function( e ) {
				rootNode.change( e.handler.options );
			}
		},
		saveLocal: {
			get: function( e ) {
				var path = e.publisher.path;
				setTimeout( function() {
					hm( path ).saveLocal();
				}, 1 );
			}
		}
	};

	var viewIdManager = {

		getId: function( elem ) {
			return $( elem ).hmData( "viewId" );
		},

		unMark: function( elem ) {
			$( elem ).hmData( "viewId", undefined );
		},

		mark: function( elem ) {
			if (isObject( elem ) && !$( elem ).hmData( "viewId" )) {
				$( elem ).hmData( "viewId", ++viewId );
			}
		}
	};

	// -------- private ------------- //
	//the reason that we want to buildUniqueViewEventTypes is that
	//when unbind or undelegate the viewEventTypes, we want to the viewEventTypes
	//as unique as possible, check the unsubscribe method
	//
	//input: getUniqueViewEventTypes("click dblClick", viewWithViewId3, "customer")
	//output: "click.__hm.3.customer dblClick.__hm.3.customer"
	//input: getUniqueViewEventTypes("click dblClick", viewWithViewId3, viewWithViewId4)
	//output: "click.__hm.3.4 dblClick.__hm.3.4"
	//it try to append an event name with and ".__hm.viewId.subscriberId"
	function buildUniqueViewEventTypes( originalEventTypes, publisherView, subscriber ) {

		var publisherViewId = viewIdManager.getId( publisherView );

		/*	if original viewEvents is "click dblClick",
		 and it bind to path "firstName", it will convert to
		 click.__hm.firstName dblClick.__hm.firstName, the reason is that
		 when path is deleted, the method unbind(object) need to unbind
		 event by a namespace, if firstName is deleted, we can unbind ".__hm.firstName"*/
		return $.map(
			originalEventTypes.split( rSpaces ),
			function( originalEventName ) {
				return isString( subscriber ) ?
					originalEventName + "." + shadowNamespace + "." + publisherViewId + "." + subscriber :
					originalEventName + "." + shadowNamespace + "." + publisherViewId + "." + viewIdManager.getId( subscriber );
			}
		).join( " " );
	}

	//if object is dom element or jQuery selector then wrap into jQuery
	//if object is model path, wrap it into model
	//if it is pure object, return as it is
	//if it is _, return null
	function tryWrapPublisherSubscriber( publisherOrSubscriber ) {
		if (isString( publisherOrSubscriber )) {
			return hm( publisherOrSubscriber );

		} else if (isObject( publisherOrSubscriber ) && !publisherOrSubscriber.nodeType) {
			//not a DOM element
			return publisherOrSubscriber;

		} else if (!isUndefined( publisherOrSubscriber )) {

			return $( publisherOrSubscriber );
		}
	}

	function replaceDotOrStar( match ) {
		//if match is ".", normalize it to "\\."
		//if match is "*", normalize it to ".*"
		return match == "." ? "\\." : ".*";
	}

	//if one of the subscribed events is matched with triggering event
	//return that subscribed event
	function getMatchedSubscribedEvent( subscribedEvents, triggeringEvent ) {

		var match,
			source,
			rMatchWithTriggeringEvent,
			eventSubscribed,
			isEndWithStarDot,
			i;

		if (subscribedEvents === "*") {
			return "*";
		}

		subscribedEvents = subscribedEvents.split( rSpaces );

		for (i = 0; i < subscribedEvents.length; i++) {

			eventSubscribed = subscribedEvents[i];

			isEndWithStarDot = rEndWithStarDot.test( eventSubscribed );

			source = isEndWithStarDot ?
				//if eventSubscribed is like "*." or "before*.";
				eventSubscribed.replace( rEndWithStarDot, "" ) :
				eventSubscribed;

			source = source.replace( rDotOrStar, replaceDotOrStar );

			source = isEndWithStarDot ? "^" + source : "^" + source + "$";

			rMatchWithTriggeringEvent = new RegExp( source, "i" );

			match = rMatchWithTriggeringEvent.test( triggeringEvent );

			if (match) {
				if (isEndWithStarDot) {
					//in other browser, in the following is enough
					//var remaining = RegExp.rightContext;
					//
					//however in IE has a bug that, if rTemp is /^/, RegExp.rightContext return ""
					//while other browser RegExp.rightContext return the remaining
					//see http://jsbin.com/ikakuw/2/edit
					var remaining = source == "^" ? triggeringEvent : RegExp.rightContext;

					//if remaining is empty or remaining does not contains "."
					if (!remaining || !remaining.contains( "." )) {
						return subscribedEvents[i];
					}
				} else {
					return subscribedEvents[i];
				}
			}
		}
	}

	//check if subscription matched with the triggering event,
	// and invoke its workflow, and also cascade the events to
	//horizontally, e is mutable
	function callbackModelSubscriptionHandler( e ) {

		var subscription,
			watchingPaths,
			cascadeEvent,
			i,
			j,
			subscriptionsByPublisher = e.publisher.subsToMe();

		for (i = 0; i < subscriptionsByPublisher.length; i++) {

			subscription = subscriptionsByPublisher[i];

			e.matchedType = getMatchedSubscribedEvent( subscription.eventTypes, e.type );

			if (e.matchedType) {
				executeHandler( tryWrapPublisherSubscriber( subscription.subscriber ), subscription.handler, e );
			}

			if (e.isImmediatePropagationStopped()) {
				return;
			}
		}

		if (!e.isCascadeStopped()) {

			watchingPaths = watchTable[e.publisher.path];

			if (watchingPaths) {
				for (j = 0; j < watchingPaths.length; j++) {

					cascadeEvent = trigger(
						watchingPaths[j],
						e.originalPublisher.path,
						e.type
					);

					if (cascadeEvent.isImmediatePropagationStopped() || cascadeEvent.isImmediatePropagationStopped()) {
						return;
					}

					if (cascadeEvent.hasError()) {
						e.error();
					}
				}
			}
		}
	}

	//#debug

	if (location.search.contains( "debug" )) {
		defaultOptions.debug = true;
	}

	function unwrapObject( object ) {
		if (object) {
			if (!isUndefined( object.path )) {
				return hm.util.toLogicalPath( object.path );
			} else {
				return object[0];
			}
		} else {
			return "null";
		}
	}

	//#end_debug

	function executeHandler( subscriber, handler, e, triggerData ) {

		//#debug
		if (defaultOptions.debug) {
			log( unwrapObject( e.publisher ),
				e.type,
				unwrapObject( subscriber ),
				handler,
				unwrapObject( e.originalPublisher )
			);
		}
		//#end_debug

		var value,
			clonedEventArg;

		e.handler = handler;
		e.subscriber = subscriber;

		if (!isUndefined( triggerData )) {
			//in the get method "this" refer to the handler
			value = handler.get.apply( subscriber, [e].concat( triggerData ) );
		} else {
			//in the get method "this" refer to the handler
			value = handler.get.call( subscriber, e );
		}

		if (e.isAborted()) {
			return;
		}

		if (isPromise( value )) {
			clonedEventArg = extend( true, {}, e );
			value.done( function( value ) {
				if (handler.convert) {
					//in the convert method "this" refer to the handler
					value = handler.convert.call( subscriber, value, e );
				}

				if (handler.set || handler.finalize) {
					//make sure it is a real promise object
					if (isPromise( value )) {
						value.done( function( value ) {
							setAndFinalize( subscriber, handler, value, clonedEventArg );
						} );

					} else {
						return setAndFinalize( subscriber, handler, value, e );
					}
				}
			} );
		} else {
			if (handler.convert) {
				//in the convert method "this" refer to the handler
				value = handler.convert.call( subscriber, value, e );
			}

			if (handler.set || handler.finalize) {
				//make sure it is a real promise object
				if (isPromise( value )) {
					clonedEventArg = extend( true, {}, e );
					value.done( function( value ) {
						setAndFinalize( subscriber, handler, value, clonedEventArg );
					} );

				} else {
					setAndFinalize( subscriber, handler, value, e );
				}
			}
		}

	}

	function setAndFinalize( subscriber, handler, value, e ) {
		if (value === dummy) {
			value = undefined;
		}
		handler.set && handler.set.call( subscriber, value, e );
		handler.finalize && handler.finalize.call( subscriber, value, e );
	}

	function subscribeModelEvent( publisherPath, eventTypes, subscriber, handler, options ) {

		var match,
			delayMiniSecond,
			initEvent,
			events;

		events = eventTypes.split( " " );

		for (var i = 0; i < events.length; i++) {
			match = rInit.exec( events[i] );
			if (match) {
				initEvent = events[i];
				delayMiniSecond = +match[1];
				events.splice( i, 1 );
				eventTypes = events.join( " " );
				break;
			}
		}

		handler = buildHandler( handler, publisherPath, subscriber, options );

		if (eventTypes) {
			subscriptionManager.add( subscriber, publisherPath, eventTypes, handler );
		}

		if (initEvent) {
			var init = function() {
				var e = new Event( publisherPath, publisherPath, initEvent );
				executeHandler( tryWrapPublisherSubscriber( subscriber ), handler, e );
			};

			if (delayMiniSecond) {
				setTimeout( init, delayMiniSecond );
			} else {
				init();
			}
		}
	}

	//subscribe jQuery event
	function subscribeViewEvent( viewPublisher, eventTypes, subscriber, handler, options, delegateSelector ) {

		//get/set/convert/[init]/[options]
		var needInit,
			eventSeedData,
			temp;

		temp = eventTypes.split( " " );

		if (temp.contains( "init" )) {
			needInit = true;
			eventTypes = temp.remove( "init" ).join( " " );
		}

		handler = buildHandler( handler, viewPublisher, subscriber, options );

		eventSeedData = {
			handler: handler,
			subscriber: subscriber
		};

		if (eventTypes) {
			eventTypes = buildUniqueViewEventTypes( eventTypes, viewPublisher, subscriber );

			if (delegateSelector) {
				handler.delegateSelector = delegateSelector;
				$( viewPublisher ).delegate( delegateSelector, eventTypes, eventSeedData, viewHandlerGateway );

			} else {
				$( viewPublisher ).bind( eventTypes, eventSeedData, viewHandlerGateway );

			}

			//we have passed handler, subscriber, options as jQuery eventSeedData,
			//we still need to add them to subscriptions so that
			//the view event handler can be unbind or undelegate
			subscriptionManager.add( subscriber, viewPublisher, eventTypes, handler );

			if (needInit) {
				if (delegateSelector) {
					$( viewPublisher ).find( delegateSelector ).trigger( eventTypes );
				} else {
					$( viewPublisher ).trigger( eventTypes );
				}
			}

		} else if (needInit) {

			$( viewPublisher ).one( "init", eventSeedData, viewHandlerGateway );
			$( viewPublisher ).trigger( "init" );

		}
	}

	function abort() {
		this.isAborted = returnTrue;
	}

	//the general jQuery event handler
	function viewHandlerGateway( e ) {
		e.publisher = tryWrapPublisherSubscriber( e.currentTarget );
		e.originalPublisher = tryWrapPublisherSubscriber( e.target );
		e.isAborted = returnFalse;
		e.abort = abort;
		var subscriber = tryWrapPublisherSubscriber( e.data.subscriber );

		var handler = e.data.handler;
		delete e.data;

		if (arguments.length > 1) {
			executeHandler( subscriber, handler, e, slice.call( arguments, 1 ) );

		} else {
			executeHandler( subscriber, handler, e );
		}
	}

	function buildHandler( workflowPrototype, publisher, subscriber, initializeOptions ) {

		var handler;

		workflowPrototype = workflowPrototype || "";

		if (isString( workflowPrototype )) {

			handler = buildHandlerFromString( workflowPrototype, publisher, subscriber, initializeOptions );

		} else if (isFunction( workflowPrototype )) {

			handler = extend( {
					get: workflowPrototype,
					options: initializeOptions
				},
				workflowPrototype
			);

		} else if (isObject( workflowPrototype ) && workflowPrototype.get) {

			handler = extend( {
				options: initializeOptions
			}, workflowPrototype );

		} else {
			throw "invalid workflow expression";
		}

		initializeHandler( handler, publisher, subscriber, initializeOptions );

		convertStringAccessorToFunction( "get", handler, publisher, subscriber );
		convertStringAccessorToFunction( "set", handler, publisher, subscriber );
		//
		convertStringActivityToFunction( "convert", handler, publisher, subscriber );
		convertStringActivityToFunction( "finalize", handler, publisher, subscriber );

		return handler;
	}

	// example of workflowString
	// zero token, the subscriber must be function in repository
	//
	// single token like "*workflow", "val", "html", "#path",
	// "val" will expand to "val set" or "get val" depending the type of publisher
	//
	// multiple tokens, all token can starts with "*", "#",
	// but only "get" and "set" token can start normal characters,
	// such as "val", "html"
	function buildHandlerFromString( workflowString, publisher, subscriber, initializeOptions ) {

		//get set convert initialize finalize
		var handler,
			embeddedHandler,
			activityName,
			activityNames = workflowString.split( rSpaces ),
			activityType;

		if (activityNames.length == 1) {

			if (workflowString.startsWith( "*" )) {

				handler = workflowStore[workflowString.substr( 1 )];
				if (!handler) {
					throw "common workflow " + workflowString + " does not exist";
				}

				handler = extend( {}, handler );

			} else if (workflowString.startsWith( "#" )) {

				embeddedHandler = getEmbeddedActivity( workflowString, publisher, subscriber );

				if (isFunction( embeddedHandler )) {
					handler = extend( {
						get: embeddedHandler,
						options: initializeOptions
					}, embeddedHandler );
				} else if (isObject( embeddedHandler ) && embeddedHandler.get) {
					handler = extend( {
						options: initializeOptions
					}, embeddedHandler );
				} else {
					throw "missing handler";
				}

			} else if (!isUndefined( publisher ) && !isUndefined( subscriber )) {

				handler = inferHandlerFromPublisherSubscriberWithSingleActivity(
					publisher,
					subscriber,
					workflowString );

			} else {
				//either model is empty or view is empty,
				// and the workflow string is a single
				//key, and the key is not workflow type
				throw "invalid handler";
			}

		} else {
			//this is the case
			//activityNames.length > 1

			handler = { };

			//activityTypes is [get,set,convert,finalize,initialize]
			for (var i = 0; i < activityTypes.length; i++) {
				activityName = activityNames[i]; //activityName is the token in workflow string
				activityType = activityTypes[i]; //activityType is one of get,set,convert,finalize,initialize

				if (activityName && (activityName !== "_" && activityName != "null")) {
					handler[activityType] = activityName;
				}
			}
		}
		return handler;
	}

	//get embedded handler helper by path
	//the path should be a path prefix with "#"
	//that path can be absolute path like "#/a.b"
	//or it can be relative path relative to subscriber model or publisher model
	function getEmbeddedActivity( activityNamePrefixWithSharpCharacter, publisher, subscriber ) {

		var modelPath = activityNamePrefixWithSharpCharacter.substr( 1 );

		modelPath = isString( subscriber ) ? mergePath( subscriber, modelPath ) :
			isString( publisher ) ? mergePath( publisher, modelPath ) :
				modelPath;

		return rootNode.raw( modelPath );
	}

	function initializeHandler( handler, publisher, subscriber, workflowOptions ) {

		var initialize = handler.initialize;

		if (isString( initialize )) {
			if (initialize.startsWith( "*" )) {
				initialize = hm.activity.initialize[initialize.substring( 1 )];
				if (!initialize) {
					throw "initialize activity does not exist!";
				}
			} else {
				var path = initialize;
				if (!rootNode.raw( path )) {
					throw "initialize activity does not exist at path " + path;
				}
				initialize = function( publisher, subscriber, handler, options ) {
					rootNode.set( path, publisher, subscriber, handler, options );
				};
			}
		}

		if (initialize) {
			initialize( tryWrapPublisherSubscriber( publisher ), tryWrapPublisherSubscriber( subscriber ), handler, workflowOptions );
		} else if (!isUndefined( workflowOptions )) {
			handler.options = workflowOptions;
		}
	}

	function inferHandlerFromPublisherSubscriberWithSingleActivity( publisher, subscriber, activityName ) {
		//now workflowString does not startsWith *, it is not a workflow type
		//infer handler from publisher and subscriber
		//
		var handler,
			isPublisherModel = isString( publisher ),
			isSubscriberModel = isString( subscriber );

		if (isPublisherModel) {
			//if publisher is model, then the logic is
			//will get model's value using default get activity,
			//and update the view using workflow or  default "set" activity
			//
			handler = {

				get: "get",

				//if workflowString is not empty, it is the set method, for example
				//$("#lable").sub(hm("message"), "text");
				//
				//if workflowString is empty,
				// then it should be the case when model subscribe model
				//copy value of one node to an other node
				//hm("message").sub(hm("name"), "afterUpdate");
				set: activityName || "set"


			};

		} else if (isSubscriberModel) {

			// model subscribe view event

			if (activityName) {
				//hm("name").sub($("#textBox", "change");
				handler = {
					get: activityName,
					set: "set"
				};
			} else {

				//if workflowString is empty
				//when model subscribe view without handler
				//the model is the handler by itself
				//e.g
				//hm("functionNode").subscribe($("button"), "click");
				var temp = rootNode.raw( subscriber );
				if (isFunction( temp )) {

					handler = {
						get: rootNode.raw( subscriber )
					};

				} else if (isObject( temp ) && temp.get) {

					handler = temp;

				} else {
					throw "missing handler";
				}
			}

		} else {
			//view subscribe view's event
			//this is rarely the case, but it is still supported
			//for example, a label subscribe the change of another label
			//$("#lable2").sub("#lable1", "text");
			handler = {
				get: activityName,
				set: activityName
			};
		}

		return handler;
	}

	function buildWorkflow( workflowPrototype ) {

		var workflow;

		if (isString( workflowPrototype )) {

			workflow = buildWorkflowFromString( workflowPrototype );

		} else if (isFunction( workflowPrototype ) || (isObject( workflowPrototype ) && workflowPrototype.get)) {

			workflow = workflowPrototype;
			if (isFunction( workflowPrototype )) {

				workflow = extend(
					{
						get: workflowPrototype
					},
					workflow );
			}

		} else {
			throw "invalid workflow expression";
		}

		convertStringActivityToFunction( "initialize", workflow );
		//
		convertStringAccessorToFunction( "get", workflow );
		convertStringAccessorToFunction( "set", workflow );
		//
		convertStringActivityToFunction( "convert", workflow );
		convertStringActivityToFunction( "finalize", workflow );

		return workflow;
	}

	function buildWorkflowFromString( workflowString ) {

		var workflow,
			activityName,
			activityNames = workflowString.split( rSpaces ),
			activityType;

		if (activityNames.length > 1) {

			workflow = { };

			for (var i = 0; i < activityTypes.length; i++) {
				activityName = activityNames[i];
				activityType = activityTypes[i];

				if (activityName && (activityName !== "_" && activityName != "null")) {
					workflow[activityType] = activityName;
				}
			}
		} else {
			throw "invalid workflow type";
		}

		return workflow;
	}

	function getActivitySet( activityType ) {
		return hm.activity[activityType];
	}

	// publisher, subscriber is optional
	//accessor either "get" or "set"
	function convertStringAccessorToFunction( accessorType, handler, publisher, subscriber ) {

		//by default workflow.get == "get", workflow.set = "set"
		var accessorKey = handler[accessorType];

		if (accessorKey && isString( accessorKey )) {

			var accessors = getActivitySet( accessorType );

			if (accessorKey.startsWith( "*" )) {

				accessorKey = accessorKey.substr( 1 );
				handler[accessorType] = accessors[accessorKey];

				if (!handler[accessorType]) {
					throw accessorKey + " does not exists " + accessorType + " Activity";
				}

			} else if (accessorKey.startsWith( "#" )) {

				handler[accessorType] = getEmbeddedActivity( accessorKey, publisher, subscriber );

			} else {

				var keys = accessorKey.split( "*" );

				//use defaultGet or defaultSet and parseSubs, if accessorKey does not begin with "*"
				// handler.setProperty = accessorKey or
				// handler.getProperty = accessorKey
				handler[accessorType] = accessorType == "get" ? getMember : setMember;
				handler[accessorType + "Name"] = keys[0];

				if (keys[1]) {
					//accessorKey = "css*color"
					handler[accessorType + "Paras"] = keys[1];
				}

				if (!isUndefined( publisher ) && !isUndefined( subscriber )) {
					var publisherOrSubscriber = accessorType == "get" ? publisher : subscriber;
					ensureTargetHasAccessor( accessorType, keys[0], publisherOrSubscriber );
				}
			}
		}
	}

	function ensureTargetHasAccessor( accessorType, activityName, target ) {
		var missingMember;
		if (isString( target )) {

			if (!hmFn[activityName]) {

				missingMember = true;
			}

		} else {
			if (target.nodeType) {
				if (!$fn[activityName]) {
					missingMember = true;
				}
			} else if (!(activityName in target)) {
				missingMember = true;
			}
		}

		if (missingMember) {
			throw (accessorType == "get" ? "publisher" : "subscriber") +
			      " does not have a member " + activityName;
		}
	}

	//activityType is like initialize, convert, finalize
	//activityType for "get", "set" is taken care by convertStringAccessorToFunction
	function convertStringActivityToFunction( activityType, handler, publisher, subscriber ) {
		//because it is optional, we need make sure handler want to have this method
		var activityName = handler[activityType];
		if (isString( activityName )) {

			if (activityName.startsWith( "*" )) {
				handler[activityType] = getActivitySet( activityType )[activityName.substr( 1 )];
				if (!handler[activityType]) {
					throw  activityName + "Activity does not exists";
				}

			} else if (activityName.startsWith( "#" )) {

				handler[activityType] = getEmbeddedActivity( activityName, publisher, subscriber );

			} else {
				throw 'activity other than "get" and "set"  must begin with "*" or "#" ';

			}
		}
	}

	function unsubscribe( target ) {
		if (isObject( target )) {
			if (!viewIdManager.getId( target )) {
				return;
			}
			viewIdManager.unMark( target );
		}
		subscriptionManager.removeBy( target );
	}

	hm.onDeleteNode( unsubscribe );

	//subscription shortcut method for model
	extend( hmFn, {

		trigger: function( subPath, eventName, proposed, removed ) {

			if (!arguments.length) {
				throw "missing arguments";
			}

			if (arguments.length <= 3) {
				removed = proposed;
				proposed = eventName;
				eventName = subPath;
				subPath = "";
			}

			var physicalPath = this.physicalPath( subPath );
			trigger( physicalPath, physicalPath, eventName, proposed, removed );
			return this;
		},

		change: function( subPath ) {
			var physicalPath = this.physicalPath( subPath ),
				value = this.get( subPath );
			trigger( physicalPath, physicalPath, "afterUpdate", value, value );
			return this;
		},

		sub: function( publisher, events, handler, options, delegateSelector ) {
			hm.sub( this.path, publisher, events, handler, options, delegateSelector );
			return this;
		},

		handle: function( eventTypes, workflow, workflowOptions, delegate ) {
			hm.sub( null, this, eventTypes, workflow, workflowOptions, delegate );
			return this;
		},

		subBy: function( subscriber, events, handler, options, delegateSelector ) {
			hm.sub( subscriber, this.path, events, handler, options, delegateSelector );
			return this;
		},

		subsToMe: function( print ) {
			var rtn = subscriptionManager.getByPublisher( this.path );
			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this.path, rtn, "toMe" );
			}
			//#end_debug

			return rtn;
		},

		subsFromMe: function( print ) {
			var rtn = subscriptionManager.getBySubscriber( this.path );
			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this.path, rtn, "fromMe" );
			}
			//#end_debug

			return rtn;
		},

		subs: function( print ) {
			var rtn = subscriptionManager.getBy( this.path );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this.path, rtn );
			}
			//#end_debug

			return rtn;
		},

		/*
		 map an model event to a new model event based on a condition, like the following

		 hm("inventory").mapEvent(
		 "afterUpdate",
		 "inventoryLow",
		 function (value) {
		 return value <= 100;
		 }
		 );

		 condition is optional, if it is missing, the target event will always be triggered
		 when the source event is triggered
		 */
		mapEvent: function( sourceEvent, targetEvent, condition ) {
			condition = condition || returnTrue;
			hm.handle( this.path, sourceEvent, function( e ) {
				if (condition.call( this, e )) {
					e.publisher.trigger( targetEvent, e.proposed, e.removed );
				}
			} );
			return this;
		},

		cacheable: function( subPath ) {
			hm.handle( this.getPath( subPath ), "init after*", "*saveLocal" );
			return this;
		}

	} );

	//subscription shortcut method for jQuery object
	extend( $fn, {

		sub: function( publisher, events, handler, options, delegate ) {
			if (this.length) {
				hm.sub( this, publisher, events, handler, options, delegate );
			}
			return this;
		},

		handle: function( eventTypes, workflow, workflowOptions, delegate ) {
			if (this.length) {
				hm.sub( null, this, eventTypes, workflow, workflowOptions, delegate );
			}
			return this;
		},

		subBy: function( subscriber, events, handler, options, delegate ) {
			if (this.length) {
				hm.sub( subscriber, this, events, handler, options, delegate );
			}
			return this;
		},

		subsToMe: function( print ) {
			var rtn = subscriptionManager.getByPublisher( this[0] );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this[0], rtn, "toMe" );
			}
			//#end_debug

			return rtn;
		},

		subsFromMe: function( print ) {
			var rtn = subscriptionManager.getBySubscriber( this[0] );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this[0], rtn, "fromMe" );
			}
			//#end_debug

			return rtn;
		},

		subs: function( print ) {
			var rtn = subscriptionManager.getBy( this[0] );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this[0], rtn );
			}
			//#end_debug

			return rtn;
		},

		renderView: function( path, workflow, options ) {
			hm.sub( this, path, "init", workflow, options );
			return this;
		},

		/*
		 map a view event to a new view event based on a condition, condition is optional,
		 if it is missing, the target event will always be triggered when the source
		 event is triggered

		 usage
		 $("button").mapEvent("click", "update");
		 */
		mapEvent: function( sourceEvent, targetEvent, condition, eventData ) {
			if (condition) {
				if (!isFunction( condition )) {
					eventData = condition;
					condition = returnTrue;
				}
			} else {
				condition = returnTrue;
			}

			return this.handle( sourceEvent, function( e ) {
				if (condition.call( this, e )) {
					e.type = targetEvent;
					e.eventData = eventData;
					e.publisher.trigger( e );
				}
			} );
		}
	} );

	// create a special jQuery event (y) based on an existing jQuery event (x)
	// when event x is raised, and condition returns true, event y will be raised
	//
	// you can subscribe event y, just like any other jQuery event using
	//$("button").bind("y", fn);
	//
	//unlike $().mapEvent("click", "y"), this method create a new event type for all
	//jQuery object
	hm.newJqEvent = function( event, baseEvent, condition ) {
		if (isObject( event )) {
			for (var key in event) {
				hm.newJqEvent( key, event[key][0], event[key][1] );
			}
			return this;
		}
		var handler = function( e ) {
			if (condition === true || condition.call( this, e )) {
				$( e.target ).trigger( extend( {}, e, {
					type: event,
					currentTarget: e.target
				} ) );
			}
		};

		if ($.event.special[event]) {
			throw "event '" + event + "' has been defined";
		}

		$.event.special[event] = {
			setup: function() {
				$( this ).bind( baseEvent, handler );
			},
			teardown: function() {
				$( this ).unbind( baseEvent, handler );
			}
		};
		return this;
	};

	var _cleanDataForUnsubscribe = $.cleanData;
	//when an dom element is remove unsubscribe it first
	$.cleanData = function( elems ) {
		$( elems ).each( function() {
			unsubscribe( this );
		} );
		_cleanDataForUnsubscribe( elems );
	};

	util.getUniqueViewEventTypes = buildUniqueViewEventTypes;
	util._viewHandlerGateway = viewHandlerGateway;

	//#debug
	hm.debug.getMatchedSubscribedEvent = getMatchedSubscribedEvent;
	hm.debug.buildWorkflowType = buildWorkflow;
	hm.debug.getMember = getMember;
	hm.debug.setMember = setMember;
	hm.debug.unsub = function( object ) {
		unsubscribe( object );
	};
	//#end_debug


//
//<@depends>subscription.js, model.js</@depends>


	var rSubscriptionProperty = /([!$]?)([\w \+\-\*\.]+?):([\w\W]+?)\s*(?:[;]\s*|$)/g,
		rBindingText = /^([^|]+)(\|(.*))?$/,
		rSubscriptionValueSeparator = /\s*\|\s*/g;

	defaultOptions.subsAttr = "data-sub";
	defaultOptions.autoParse = true;

	function mergeOptions( parentOptions, localOptions ) {
		if (localOptions !== "_") {
			return  (localOptions && localOptions.startsWith( "_" )) ?
				localOptions.substr( 1 ) :
				parentOptions || localOptions;
		}
	}

	function getInheritedNamespace( elem ) {

		var $parent = $( elem );

		while (($parent = $parent.parent()) && $parent.length) {

			var ns = $parent.hmData( "ns" );

			if (!isUndefined( ns )) {
				return ns;
			}
		}
		return "";
	}

	var reUnderscore = /_/g;
	var reAttrDash = /-(\w)/g;
	var rDataAttrPrefix = /^data-/;

	var replaceAttrDashWithCapitalCharacter = function( match, $1 ) {
		return $1.toUpperCase();
	};

	//convert add-class to addClass
	//convert $enter_blur to $enter blur
	function normalizeAttributeName( attributeName ) {
		attributeName = attributeName.replace( rDataAttrPrefix, "" );

		//if subscription involve with more than one events, you can
		//concatenate them with "_", here we need to revert them back
		//such as "$click_mouseover" need to be changed to "$click mouseover"
		if (attributeName.startsWith( "!" ) || attributeName.startsWith( "$" )) {

			attributeName = attributeName.replace( reUnderscore, " " );

		}
		return attributeName.replace( reAttrDash, replaceAttrDashWithCapitalCharacter );
	}

	function extractSubscriptionText( elem ) {
		if (elem.nodeType !== 1) {
			return;
		}
		var i,
			attr,
			attributeName,
			attributes = elem.attributes,
			subscriptionText = attributes[defaultOptions.subsAttr] && attributes[defaultOptions.subsAttr].nodeValue || "";

		for (i = 0; i < attributes.length; i++) {
			attr = attributes[i];
			if (attr.name !== defaultOptions.subsAttr) {
				attributeName = normalizeAttributeName( attr.name );
				//if attributeName is recognized by the Hm.js,
				// such as ns="xxx", bindingName="xxx", !event="xxx" , $event="xxx"
				//extract them and append to the subscription text
				if (attributeName == "ns" || _bindings[attributeName]) {
					//if the attribute does not have a value like <div debug>
					//it is the same as <div debug="/">
					subscriptionText = subscriptionText + ";" + attributeName + ":" + (attr.nodeValue || "/");

				} else if (attributeName.startsWith( "!" ) || attributeName.startsWith( "$" )) {
					var nodeValues = attr.nodeValue.split( ";" );
					for (var j = 0; j < nodeValues.length; j++) {
						var nodeValue = nodeValues[j];
						subscriptionText = subscriptionText + ";" + attributeName + ":" + nodeValue;
					}
				}
			}
		}

		var tagBindingName = "tag_" + elem.tagName;
		if (_bindings[tagBindingName]) {
			subscriptionText = subscriptionText + ";" + tagBindingName + ":.";
		}
		return subscriptionText.replace( /^;/, "" );
	}

	//support
	//new Binding()
	//new Binding(subscriptionText, parentBinding)
	//new Binding("$click|*alert;val:path", parentBinding);
	function Binding( subscriptionText, parentBinding, bindingNs, bindingOptions ) {

		var nsProperty, match, emptyBinding;

		//handle the case: new Binding()
		if (!subscriptionText) {
			//
			//shared property
			this.subscriptions = [];
			return;
		}

		//handle the case : new Binding (elem);
		if (subscriptionText.nodeType) {
			var elem = subscriptionText;
			subscriptionText = parentBinding || extractSubscriptionText( elem );
			if (subscriptionText) {
				emptyBinding = new Binding();
				emptyBinding.elem = elem;
				emptyBinding.ns = getInheritedNamespace( elem );
				return new Binding( subscriptionText, emptyBinding );
			}
			return;
		}

		if (!parentBinding) {
			emptyBinding = new Binding();
			//fake an elem
			emptyBinding.elem = {};
			return new Binding( subscriptionText, emptyBinding );
		}

		//handle the case: new Binding(subscriptionText, parentBinding);
		//
		//private data
		this.sub = [];
		this.pub = [];
		this.bindings = [];

		while ((match = rSubscriptionProperty.exec( subscriptionText ))) {

			var prefix = match[1],
				prop = $.trim( match[2] ),
				value = $.trim( match[3] );

			if (prefix) {

				this[prefix == "$" ? "pub" : "sub"].push( { eventTypes: prop, value: value } );

			} else {

				if (prop == "ns") {
					nsProperty = value;

				} else {
					this.bindings.push( { bindingName: prop, value: value} );
				}
			}
		}

		this.ns = mergePath( mergePath( parentBinding.ns, bindingNs ), nsProperty );
		//shared data
		this.text = subscriptionText;
		this.elem = parentBinding.elem;
		//this is a singleton
		//this.subscriptions = parentBinding.subscriptions;

		if (parentBinding.context) {

			this.context = parentBinding.context;

		} else {

			this.context = this;
			this.dynamicBindings = [];
			this.subscriptions = [];
			$( this.elem ).hmData( "ns", this.ns );
		}

		this.options = mergeOptions( parentBinding.options, bindingOptions );

		this._importBindings();
		this._importSubscriptions( "sub" );
		this._importSubscriptions( "pub" );

	}

	Binding.prototype = {

		_importBindings: function() {

			var i,
				bindingName,
				wellknownBinding,
				binding,
				subTextParts,
				bindingNs,
				bindingOptions,
				bindings = this.bindings;

			for (i = 0; i < bindings.length; i++) {

				binding = bindings[i];
				bindingName = binding.bindingName;

				//if value is "path|option1|option2"
				//
				subTextParts = rBindingText.exec( binding.value );
				bindingNs = subTextParts[1]; // "path"
				bindingOptions = subTextParts[3]; //"option1|option2"

				wellknownBinding = _bindings[bindingName];

				if (isFunction( wellknownBinding )) {

					var temp = [
						wellknownBinding,
						this.elem,
						mergePath( this.ns, bindingNs ),
						this,
						mergeOptions( this.options, bindingOptions )
					];

					if (bindingName == "runFirst") {

						this.context.runFirst = temp;

					} else if (bindingName == "runLast") {

						this.context.runLast = temp;

					} else {

						this.context.dynamicBindings.push( temp );
					}

				} else if (isString( wellknownBinding )) {

					//recursively import referencedBinding
					new Binding( wellknownBinding, this, bindingNs, bindingOptions );

				}
			}
		},

		//subscriptionType is either "pub" or "sub"
		_importSubscriptions: function( subscriptionType ) {

			var i,
				subscriptionEntry,
				subscriptionParts,
				publisher,
				eventTypes,
				subscriber,
				subscriptionEntries = this[subscriptionType];

			for (i = 0; i < subscriptionEntries.length; i++) {

				subscriptionEntry = subscriptionEntries[i];
				eventTypes = subscriptionEntry.eventTypes;

				subscriptionParts = subscriptionEntry.value.split( rSubscriptionValueSeparator );

				if (subscriptionType == "sub") {

					//path|handler|options|delegate
					publisher = subscriptionParts[0];

					publisher = publisher.startsWith( "$" ) ?
						publisher : //publisher is a view
						mergePath( this.ns, publisher );

					subscriber = this.elem;

				} else {
					//path|handler|options|delegate
					publisher = this.elem;

					subscriber = subscriptionParts[0];
					subscriber = subscriber.startsWith( "$" ) ?
						subscriber : //subscriber is a view
						mergePath( this.ns, subscriber );
				}

				this.appendSub(
					subscriber,
					publisher,
					eventTypes,
					subscriptionParts[1], //handler
					toTypedValue( mergeOptions( this.options, subscriptionParts[2] ) ), //options
					subscriptionParts[3] //delegate
				);
			}

		},

		appendSub: function( subscriber, publisher, eventTypes, handler, options, delegate ) {
			this.context.subscriptions.push( {
				publisher: publisher,
				eventTypes: eventTypes,
				subscriber: subscriber,
				handler: handler,
				options: options,
				delegate: delegate
			} );
		},

		prependSub: function prependSub( subscriber, publisher, eventTypes, handler, options, delegate ) {
			this.context.subscriptions.unshift( {
				publisher: publisher,
				eventTypes: eventTypes,
				subscriber: subscriber,
				handler: handler,
				options: options,
				delegate: delegate
			} );
		},

		clearSubs: function() {
			this.context.subscriptions.splice( 0, this.subscriptions.length );
		}
	};

	function parseSubs( elem ) {

		var subscriptionText,
			context,
			subscriptions,
			i,
			subscription,
			$elem = $( elem );

		if (!$elem.hmData( "parsed" ) && (subscriptionText = extractSubscriptionText( elem ))) {

			context = new Binding( elem, subscriptionText );
			subscriptions = context.subscriptions;

			var runFirst = context.runFirst;
			if (runFirst) {
				runFirst[0]( runFirst[1], runFirst[2], runFirst[3], runFirst[4] );
			}

			var dynamicBindings = context.dynamicBindings;
			for (i = 0; i < dynamicBindings.length; i++) {
				var dynamicBinding = dynamicBindings[i];
				dynamicBinding[0]( dynamicBinding[1], dynamicBinding[2], dynamicBinding[3], dynamicBinding[4] );
			}

			var runLast = context.runLast;
			if (runLast) {
				runLast[0]( runLast[1], runLast[2], runLast[3], runLast[4] );
			}

			for (i = 0; i < subscriptions.length; i++) {

				subscription = subscriptions[i];
				hm.sub(
					subscription.subscriber,
					subscription.publisher,
					subscription.eventTypes,
					subscription.handler,
					subscription.options,
					subscription.delegate
				);
			}

			//#debug
			context.debug && context.print();
			//#end_debug

			//
			$elem.hmData( "parsed", true );
		}

		$elem.children().each( function() {
			parseSubs( this );
		} );
	}

	//delay auto parse to way for some dependencies to resolve asynchronously
	setTimeout( function() {
		$( function() {
			if (defaultOptions.autoParse) {
				parseSubs( document.documentElement );
			}
		} );
	}, 1 );

	$fn.parseSubs = function() {
		return this.each( function() {
			parseSubs( this );
		} );
	};

	var logModel = hm( "*log", [] );

	var _bindings = {};

	function bindings( name, definition, isTag ) {
		if (!name) {
			return _bindings;
		}

		if (!definition) {

			if (isObject( name )) {
				for (var key in name) {
					bindings( key, name[key] );
				}
				return this;

			} else {
				return _bindings[name];
			}
		}

		if (isArray( definition )) {
			definition = definition.concat( ";" );
		}

		_bindings[isTag ? "tag_" + name.toUpperCase() : name] = definition;
		return this;
	}

	extend( hm, {

		binding: bindings,

		//#debug
		Binding: Binding,
		//#end_debug

		log: function( message, color ) {
			message = message + "";
			message = color ? "<div style='color:" + color + "'>" + message + "</div> " : message;
			logModel.push( message );
		},

		clearlog: function() {
			logModel.clear();
		}
	} );

	function adhocBinding( elem, path, context, options ) {
		rootNode.get( path, elem, path, context, options );
	}

	bindings( "runFirst", adhocBinding );
	bindings( "runLast", adhocBinding );

//#debug
//
//<@depends>subscription.js, model.js, declarative.js</@depends>


	Binding.prototype.print = function() {
		var subscriptions = this.subscriptions,
			elem = this.elem;

		var html = "<table border='1' cellpadding='6' style='border-collapse: collapse; width:100%;'>" +
		           "<tr><td>element</td><td colspan='6'>" + formatParty( elem ) + "</td> </tr>" +
		           "<tr><td>model path</td><td colspan='6'>" + formatParty( this.ns ) + "</td></tr>" +
		           "<tr><td>text</td><td colspan='6'>" + formatPrint( this.text ) + "</td></tr>";

		if (this.sub.length) {
			html += "<tr><td>sub</td><td colspan='6'>" + formatPrint( this.sub ) + "</td></tr>";
		}

		if (this.pub.length) {
			html += "<tr><td>pub</td><td colspan='6'>" + formatPrint( this.pub ) + "</td></tr>";
		}

		if (this.bindings.length) {
			html += "<tr><td>binding</td><td colspan='6'>" + formatPrint( this.bindings ) + "</td></tr>";
		}

		if (subscriptions.length) {

			html += "<tr>" +
			        "<th></th>" +
			        "<th>subscriber</th>" +
			        "<th>publisher</th>" +
			        "<th>eventTypes</th>" +
			        "<th>handler</th>" +
			        "<th>options</th>" +
			        "<th>delegate</th>" +
			        "</tr>";

			for (var i = 0; i < subscriptions.length; i++) {
				var subscription = subscriptions[i];
				html += "<tr>" +
				        "<td>" + (i + 1) + "</td>" +
				        "<td>" + formatParty( subscription.subscriber, elem ) + "</td>" +
				        "<td>" + formatParty( subscription.publisher, elem ) + "</td>" +
				        "<td>" + formatPrint( subscription.eventTypes ) + "</td>" +
				        "<td>" + formatPrint( subscription.handler ) + "</td>" +
				        "<td>" + formatPrint( subscription.options ) + "</td>" +
				        "<td>" + formatPrint( subscription.delegate ) + "</td>" +
				        "</tr>";
			}
		}

		html += "</table>";
		hm.log( html );

	};

	function formatParty( obj, elem ) {

		if (obj === elem) {
			return "element";
		}

		if (obj.nodeType) {
			return util.encodeHtml( obj.outerHTML ).substr( 0, 100 ) + "...";
		}

		if (isString( obj )) {
			if (obj.startsWith( "$" )) {
				return "$('" + obj.substr( 1 ) + "')";
			} else {
				if (elem) {
					return "hm('" + util.toLogicalPath( obj ) + "')";
				} else {
					return "'" + util.toLogicalPath( obj ) + "'";
				}
			}
		}

	}

	function formatPrint( obj ) {

		if (isUndefined( obj )) {
			return "";
		} else if (isFunction( obj )) {

			return util.encodeHtml( obj + "" ).substr( 0, 100 ) + "...";

		} else if (isObject( obj )) {

			var rtn = "<pre>{";
			var temp = "";
			for (var key in obj) {
				var value = obj[key];
				if (!isUndefined( value )) {
					temp += "\n " + key + ":";
					if (isString( value )) {
						temp += "'" + util.encodeHtml( value ) + "',"
					} else {
						temp += util.encodeHtml( value ) + ","
					}
				}

			}

			if (temp.length != 0) {
				temp = temp.substr( 0, temp.length - 1 );
			}
			rtn += temp;

			rtn += "\n}</pre>";
			rtn = rtn.replace( /\t/g, " " );
			return rtn;
		} else {
			return JSON.stringify( obj );
		}
	}

	hm.binding( "debug", function( elem, path, context, options ) {
		context.debug = true;
	} );

	hm.printBinding = function( elem ) {
		if (isString( elem )) {
			elem = $( "<div></div>" ).attr( hm.options.subsAttr, elem )[0];
		} else if (elem.jquery) {
			elem = elem[0];
		}

		(new hm.Binding( elem )).print();
	};

	//me can be a DOM element, or it can a string path
	hm.printSubscriptions = function( me, subscriptions, type ) {
		if (!subscriptions.length) {
			hm.log( "no subscription" );
			return;
		}

		var subsFromMe, subsToMe, i, subscription;
		if (type == "fromMe") {
			subsFromMe = subscriptions;
		} else if (type == "toMe") {

			subsToMe = subscriptions;

		} else {

			subsFromMe = $( subscriptions ).filter(function( index, item ) {
				return item.subscriber == me;
			} ).get();

			subsToMe = $( subscriptions ).filter(function( index, item ) {
				return item.publisher == me;
			} ).get();

		}

		/*return getSubscriptionsBy( subscriberOrPublisher, function match( item, target ) {
		 return item.subscriber == target || item.publisher == target;
		 } );*/

		var myDescription;

		if (isString( me ) || (me instanceof  hm)) {

			myDescription = "hm('" + util.toLogicalPath( me ) + "')";

		} else {

			myDescription = formatParty( me );

		}

		var html = "<table border='1' cellpadding='6' style='border-collapse: collapse; width:100%;'>";

		if (subsFromMe && subsFromMe.length) {
			html += "<tr><th colspan='6'><b>Subscriber: </b> " + myDescription + "</th></tr>";
			html += "<tr><th></th><th>Publisher:</th><th>events</th><th>workflow</th><th>options</th><th>delegate</th></th>";

			for (i = 0; i < subsFromMe.length; i++) {
				subscription = subsFromMe[i];
				html += "<tr>" +
				        "<td>" + (i + 1) + "</td>" +
				        "<td>" + formatParty( subscription.publisher ) + "</td>" +
				        "<td>" + formatPrint( subscription.eventTypes ) + "</td>" +
				        "<td>" + formatPrint( subscription.workflow ) + "</td>" +
				        "<td>" + formatPrint( subscription.options ) + "</td>" +
				        "<td>" + formatPrint( subscription.delegate ) + "</td>" +
				        "</tr>";
			}
		}

		if (subsToMe && subsToMe.length) {
			html += "<tr><th colspan='6'>Publisher: " + myDescription + "</th></tr>";
			html += "<tr><th></th><th>Subscriber:</th><th>events</th><th>workflow</th><th>options</th><th>delegate</th></tr>";

			for (i = 0; i < subsToMe.length; i++) {
				subscription = subsToMe[i];
				html += "<tr>" +
				        "<td>" + (i + 1) + "</td>" +
				        "<td>" + formatParty( subscription.subscriber ) + "</td>" +
				        "<td>" + formatPrint( subscription.eventTypes ) + "</td>" +
				        "<td>" + formatPrint( subscription.workflow ) + "</td>" +
				        "<td>" + formatPrint( subscription.options ) + "</td>" +
				        "<td>" + formatPrint( subscription.delegate ) + "</td>" +
				        "</tr>";
			}
		}

		html += "</table>";
		hm.log( html );

	};

//#end_debug//

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

//
//<@depends>subscription.js, model.js, declarative.js</@depends>


	var template,
		rBeginWithApk = /^apk\.([^.]+)(\.?)(.*)$/,
		rBeginWithStar = /^\*/,
		templateEngineAdapters = {},
		tmpl = {
			initialize: "*templateOptions",
			get: "get", //extensible
			convert: "*template",
			set: "html", //extensible
			finalize: "*parseSubs"
		};

	function newTemplateHandler( getter, setter, finalizer ) {
		return extend( {}, tmpl,
			isObject( getter ) ? getter : {
				get: getter,
				set: setter,
				finalize: finalizer
			} );
	}

	//options can be : templateId,wrapItem,engineName
	//
	//or it can be
	// {
	//  templateId: "xxx",
	//  wrapItem: true,
	//  engineName: "xxx"
	//}
	hm.activity.initialize.templateOptions = function( publisher, subscriber, handler, options ) {
		if (isString( options )) {

			options = options.split( "," );
			handler.templateId = $.trim( options[0] );
			handler.wrapDataInArray = $.trim( options[1] ) == "true";
			handler.engineName = options[2];

		} else if (isObject( options ) && options.templateId) {

			extend( handler, options );

		} else {

			if (!(handler.templateId = subscriber.hmData( "embeddedTemplate" ))) {

				var templateSource = $.trim( subscriber.html() );
				if (templateSource) {
					templateSource = templateSource.replace( rUnescapeTokens, unescapeTokens );
					handler.templateId = "__" + $.uuid++;
					template.compile( handler.templateId, templateSource );
					subscriber.hmData( "embeddedTemplate", handler.templateId );
					subscriber.empty();
				} else {
					throw "missing template";
				}
			}
		}
	};

	var rUnescapeTokens = /&lt;|&gt;/g;
	var unescapeMap = {
		"&lt;": "<",
		"&gt;": ">"
	};

	var unescapeTokens = function( token ) {
		return unescapeMap[token] || "";
	};

	function RenderContext( e ) {
		this.modelPath = e.publisher.path;
		this.e = e;
	}

	//shortcut to this.e.publisher.get(xxx);
	RenderContext.prototype.get = function() {
		var publisher = this.e.publisher;
		return publisher.get.apply( publisher, arguments );
	};

	//this converter is used in handlers which can want to convert data
	// to markup, these handler includes foreach, and newTemplateHandler
	//which is the core of all templateHandler
	hm.activity.convert.template = function( data, e ) {

		//if dataSource is an array, it has item(s)
		//or dataSource is non-array
		if (data &&
		    (
			    (isArray( data ) && data.length) || !isArray( data )
			    )
			) {

			//if wrapDataInArray is true, wrap data with [], so that it is an item of an array, explicitly
			//some template engine can automatically wrap your data if it is not an array.
			//if you data is already in array, it treat it as an array of items.
			//however, if you want to want to treat your array as item, you need to wrap it by your
			//self, wrapDataInArray is for this purpose

			var templateId, templateData, workflow = e.handler;

			if (workflow.templateId) {
				templateId = workflow.templateId;
				templateData = workflow.wrapDataInArray ? [data] : data;
			} else {
				templateId = data;
				templateData = {};
			}

			if (!templateId) {
				return "";
			}

			//handler.templateId, handler.wrapDataInArray, handler.engineName is
			//built in during initialization , see initializers.templateOptions
			var content = renderTemplate(

				templateId,

				templateData,

				//this context can be used to access model within the template
				new RenderContext( e ),

				workflow.engineName );

			if (isPromise( content )) {
				return content;
			}
			if (isString( content )) {

				content = $.trim( content );
			}

			//to work around a bug in jQuery
			// http://jsfiddle.net/jgSrn/1/
			return $( $( "<div />" ).html( content )[0].childNodes );
		} else {
			return "";
		}
	};

	//when the template is render, need to recursively import declarative subscriptions
	hm.activity.finalize.parseSubs = function( value, e ) {
		$( value ).parseSubs();

	};

	//add reusable event handler
	hm.workflow( {
		tmpl: tmpl,
		include: newTemplateHandler( "get", "replaceWith" )
	} );

	bindings( {

		tmpl: "!init:.|*tmpl",

		tmplOnChange: "!init after*.:.|*tmpl",

		tmplOnChildChange: "!init after*. after*.1:.|*tmpl",

		tmplOnAnyChange: "!init after*:.|*tmpl",

		include: "!init:.|*include"
	} );

	//templateOptions is templateId,wrapDataInArray,templateEngineName
	//$("div").tmpl(templateId, path)
	//$("div").tmpl(templateId, path, fn)
	//if templateWorkflowExtension is a function, the function is treated
	//as finalizer
	$fn.tmpl = function( templateOptions, modelPath, templateWorkflowExtension ) {

		modelPath = modelPath || "";

		if (isFunction( templateWorkflowExtension )) {
			templateWorkflowExtension = {
				finalize: templateWorkflowExtension
			};
		}

		return this.renderView(

			modelPath,

			templateWorkflowExtension ?
				extend( {}, tmpl, templateWorkflowExtension ) :
				"*tmpl",

			templateOptions
		);
	};

	//templateOptions is templateId,wrapDataInArray,templateEngineName
	//$("div").include(path, templateId)
	$fn.include = function( templateOptions, modelPath, templateHandlerExtension ) {

		if (isFunction( templateHandlerExtension )) {
			templateHandlerExtension = {
				finalize: templateHandlerExtension
			};
		}

		return this.renderView(
			modelPath,
			templateHandlerExtension ? extend( {}, hm.workflow( "replace" ), templateHandlerExtension ) : "*replace",
			templateOptions
		);
	};

	function getTemplateEngine( engineName ) {
		engineName = engineName || template.defaultEngine;
		if (!engineName) {
			throw "engine name is not specified or default engine name is null";
		}
		var engineAdapter = templateEngineAdapters[engineName];
		if (!engineAdapter) {
			throw "engine '" + engineAdapter + "' can not be found.";
		}
		return engineAdapter;

	}

	function renderTemplate( templateId, data, renderContext, engineName ) {

		var engineAdapter = getTemplateEngine( engineName, templateId );

		templateId = $.trim( templateId );

		//remove the starting "*" from the template id to become the realTemplateId
		var realTemplateId = templateId.replace( rBeginWithStar, "" );

		if (engineAdapter.isTemplateLoaded( realTemplateId )) {

			return engineAdapter.render( realTemplateId, data, renderContext );

		} else if (engineAdapter.renderAsync) {

			return engineAdapter.renderAsync( realTemplateId, data, renderContext );

		} else {

			var defer = $.Deferred(),
				cloneEvent = extend( true, {}, renderContext.e ),
				publisher = extend( true, {}, cloneEvent.publisher ),
				clonedContext = extend( true, {}, renderContext );

			cloneEvent.publisher = publisher;
			clonedContext.e = cloneEvent;

			//template.load is implemented in external-template.js
			template.load( templateId ).done( function() {

				var content = engineAdapter.render( realTemplateId, data, clonedContext ),
					rtn = $( content );

				defer.resolve( rtn.selector || !rtn.length ? content : rtn );

			} );

			return defer.promise();

		}
	}

	hm.template = template = {

		defaultEngine: "",

		/*
		 hm.template.myEngine = {
		 render: function( templateId, data, context ) {},
		 compile: function( templateId, source ) {},
		 isTemplateLoaded: function( templateId ) {}
		 };
		 */
		engineAdapter: function( name, engineAdapter ) {
			if (!name) {
				return templateEngineAdapters;
			}
			if (!engineAdapter) {
				return templateEngineAdapters[name];
			}
			engineAdapter.isTemplateLoaded = engineAdapter.isTemplateLoaded || returnTrue;
			templateEngineAdapters[name] = engineAdapter;
			template.defaultEngine = name;
		},

		//dynamically load a template by templateId,
		//it is called by template.render
		//The default implementation required loader.js
		//but you can override this, all you need
		// is to return is that a promise, when the promise is
		// done, the template should be ready to used
		load: function( templateId ) {
			//we need to modify the id by adding an extension to the id
			// hm.loader use extension to determine what loader is used
			// handle the actual loading work
			return _loader.load( templateId.endsWith( ".html" ) ? templateId : templateId + ".template" );
		},

		//this should be called by hm.template.load after the method
		//get the source of the template
		compile: function( templateId, source, engineName ) {
			return getTemplateEngine( engineName ).compile(
				templateId.endsWith( ".template" ) ? _loader.fileName( templateId ) : templateId,
				source );
		},

		//build a customized handler which handle the change of model
		//by default
		//getFilter is "get" which is to get model value,
		// it can be a string or function (e) {}
		//
		//setFilter is "html" which is to change the content of the view
		//it can be a string or function (e, value)
		newTemplateHandler: newTemplateHandler,

		templateIdToUrl: function( templateId ) {

			var match = rBeginWithApk.exec( templateId );

			return match ?
				//apk.hello --> applet/hello/main.html
				//apk.hello.bye --> applet/hello/bye.html
				"apk/" + match[1] + "/" + (match[3] || "main" ) + ".html" :

				//xxx.html --> xxx.html
				//xxx.yyy.html --> xxx.yyy.html
				templateId.endsWith( ".html" ) ? templateId :

					//xxx --> xxx.html
					//xxx.yyy --> xxx.html
					templateId.split( "." )[0] + ".html";

		}

	};

	_loader( "template", {

		load: {
			compile: function( moduleId, sourceCode ) {

				var $scriptList = $( sourceCode );

				var hasScriptTag = false;
				$scriptList.each( function() {

					if (this.tagName == "SCRIPT") {
						hasScriptTag = true;
						return false;
					}
				} );

				if (hasScriptTag) {

					$scriptList.each( function() {

						if (this.tagName == "SCRIPT") {

							var $sourceCodeContainer = $( this );

							template.compile(
								this.id,
								$sourceCodeContainer.html(),
								$sourceCodeContainer.attr( "type" ) || template.defaultEngine );
						}

					} );
				} else {
					template.compile( moduleId, sourceCode, template.defaultEngine );
				}

			},
			buildDependencies: "parseDependsTag"
		},

		url: function( templateId ) {
			//first truncate the ".template" in the templateId, and get the real templateId
			return template.templateIdToUrl( _loader.fileName( templateId ) );
		}
	} );

	_loader( "html", "template", {
		//		load: {
		//			compile: function( moduleId, sourceCode ) {
		//				return template.compile( moduleId, sourceCode, template.defaultEngine );
		//			}
		//		}

		url: function( templateId ) {
			return templateId;
		}
	} );


	if ($.render && $.templates) {

		var engine;


		template.engineAdapter( "jsrender", engine = {

			render: function( templateId, data, context ) {
				if (!$.render[templateId]) {
					this.compile( templateId, document.getElementById( templateId ).innerHTML );
				}
				return $.render[templateId]( data, context );
			},

			compile: function( templateId, source ) {
				$.templates( templateId, {
					markup: source,
					debug: engine.templateDebugMode,
					allowCode: engine.allowCodeInTemplate
				} );
			},

			isTemplateLoaded: function( templateId ) {
				return !!$.render[templateId] || !!document.getElementById( templateId );
			},

			//templateDebugMode is jsRender specific setting
			templateDebugMode: false,

			//allowCodeInTemplate is jsRender specific setting
			allowCodeInTemplate: true
		} );

		var tags = $.views.tags;

		//the following tags a jsrender specific helper
		tags( {
			//#debug
			//{{debugger /}} so that it can stop in template function
			"debugger": function x( e ) {
				if (x.enabled) {
					debugger;
				}
				return "";
			},
			//#end_debug

			//{{ts /}} so that it can emit a timestamp
			ts: function x() {
				return x.enabled ?
					"<span style='color:red' data-sub='show:/*ts'>updated on:" + (+new Date() + "").substring( 7, 10 ) + "</span>" :
					"";
			},

			get: function() {
				var publisher = this.ctx.e.publisher;
				return publisher.get.apply( publisher, arguments );
			},

			prop: function() {
				var index = this.tagCtx.view.index;

				if (isUndefined( index )) {
					//this is the case when template is render with
					// a single data item instead of array
					index = (this.ctx.e.publisher.count() - 1);
				}

				var itemNode = this.ctx.e.publisher.cd( index );
				return itemNode.get.apply( itemNode, arguments );
			},

			//{{fixedRowId /}}
			fixedRowId: function() {
				return "/" + this.ctx.modelPath + ".table." + this.ctx.e.publisher.itemKey( this.tagCtx.view.data );
			},

			//{{rowId /}}
			rowId: function() {
				var index = this.tagCtx.view.index,
					path = this.ctx.modelPath;

				if (isUndefined( index )) {
					//this is the case when template is render with
					// a single data item instead of array
					index = (this.ctx.e.publisher.count() - 1);
				}

				return "/" + path + "." + index;
			},

			//{{modelPath /}}
			//it useful when  in http://jsbin.com/etacob/6/edit
			modelPath: function() {
				return "/" + this.ctx.modelPath;
			}

		} );

		tags.ts.render.enabled = true;
		//#debug
		tags["debugger"].render.enabled = true;
		//#end_debug

		hm( "*ts", false );

	}



//


	var Handlebars = window.Handlebars;

	if (!isUndefined( Handlebars )) {

		hm.template.engineAdapter( "handlebars", {

			render: function( templateId, data, context ) {

				return Handlebars.partials[templateId]( data, {
					data: {renderContext: context}
				} );
			},

			compile: function( templateId, source ) {
				Handlebars.registerPartial( templateId, Handlebars.compile( source ) );
			},

			isTemplateLoaded: function( templateId ) {
				return !!Handlebars.partials[templateId];
			}

		} );

		//{{modelPath}}
		Handlebars.registerHelper( "modelPath", function( options ) {
			return options.data.renderContext.modelPath;
		} );

		//{{rowId}}
		Handlebars.registerHelper( "rowId", function( options ) {
			return "/" + options.data.renderContext.modelPath + "." + options.data.index + ";";
		} );

		//{{fixedRowId}}
		Handlebars.registerHelper( "fixedRowId", function( options ) {
			var renderContext = options.data.renderContext;
			return "/" + renderContext.modelPath + ".table." + renderContext.e.publisher.itemKey( this );
		} );

		//{{get "..setTo" name}}
		Handlebars.registerHelper( "get", function() {
			var args = arguments,
				last = args.length - 1,
			//args[last].data is options.data
				renderContext = args[last].data.renderContext;

			return renderContext.get.apply( renderContext, slice.call( args, 0, last ) );
		} );

		//{{{prop "link"}}}
		Handlebars.registerHelper( "prop", function() {
			var slice = [].slice,
				args = arguments,
				last = args.length - 1,
				options = args[last],
				data = options.data,
				renderContext = data.renderContext,
				itemNode = renderContext.e.publisher.cd( data.index );

			return itemNode.get.apply( itemNode, slice.call( args, 0, last ) );
		} );

		$( function() {
			$( "script[type=handlebars]" ).each( function() {
				Handlebars.registerPartial( this.id, Handlebars.compile( $( this )[0].innerHTML ) );
			} );
		} );

	}



//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>


	//don't change it to because we want to control the search order
	//check findValueAdapter($elem, adapterName)
	//{
	//   name1: adapter1,
	//   name2: adapter2
	//}
	var valueAdapters = [
		{
			//the default view adapter
			name: "textBoxOrDropDown",
			initialize: function( $elem, modelValue ) {
				if (modelValue) {
					if ($elem[0].tagName == "SELECT") {
						$elem.children().each( function() {
							if (this.value == modelValue) {
								$( this ).attr( "selected", "selected" );
								return false;
							}
						} );
					} else {
						$elem.attr( "value", modelValue );
					}
				}
			},
			get: function( $elem ) {
				return $elem.val();
			},
			set: function( $elem, value ) {
				if ($elem.val() !== value) {
					$elem.val( value );
				}
			},
			match: returnTrue
		},
		{
			name: "checkbox",
			initialize: function( $elem, modelValue ) {
				if (modelValue) {
					$elem.attr( "checked", "checked" );
				}
			},
			get: function( $elem, e ) {
				var elem = $elem[0];
				var value = elem.value;

				if (value == "true") {
					return true;
				} else if (value == "false") {
					return false;
				} else if (value !== "on") {
					return value;
				} else {
					return elem.checked;
				}
			},
			set: function setCheckbox( $elem, value ) {
				var elem = $elem[0];
				if (isBoolean( value )) {
					elem.checked = value;
				} else {
					elem.checked = (value == elem.value);
				}
			},
			match: function( $elem ) {
				return $elem.is( ":checkbox" );
			}
		},
		{
			name: "radio",
			initialize: function( $elem, modelValue ) {

				if (modelValue == $elem[0].value) {
					$elem.attr( "checked", "checked" );
				}
			},
			get: function( $elem, e ) {
				if (e.type == "resetVal" && !e.publisher.attr( "checked" )) {
					e.abort();
					return;
				}

				var elem = $elem[0];
				var value = elem.value;
				if (value == "true") {
					return true;
				} else if (value == "false") {
					return false;
				} else if (value !== "on") {
					return value;
				} else {
					return elem.checked;
				}
			},
			set: function( $elem, value, e ) {
				var elem = $elem[0];
				if (!elem.name) {
					elem.name = e.publisher.path;
				}
				elem.checked = ( util.toString( value ) == elem.value );
			},
			match: function( $elem ) {
				return $elem.is( ":radio" );
			}
		},
		{
			name: "listBox",
			initialize: function( $elem, modelValue ) {
				$elem.children().each( function() {
					if (modelValue.contains( this.value )) {
						$( this ).attr( "selected", "selected" );
					}
				} );
			},

			get: function( $elem ) {
				var options = [];
				$elem.children( "option:selected" ).each( function() {
					options.push( this.value );
				} );
				return options.length ? options : null;
			},
			set: function( $elem, value ) {
				$elem.children().each( function() {
					this.selected = !!(value && value.contains( this.value ));
				} );
			},
			match: function( $elem ) {
				return $elem.is( "select[multiple]" );
			}
		}
	];

	function findValueAdapter( $elem, adapterName ) {
		var i, adapter;

		if (adapterName) {
			for (i = valueAdapters.length - 1; i >= 0; i--) {
				adapter = valueAdapters[i];
				if (adapter.name == adapterName) {
					return adapter;
				}
			}
		} else {
			//search from tail to head
			for (i = valueAdapters.length - 1; i >= 0; i--) {
				adapter = valueAdapters[i];
				if (adapter.match && adapter.match( $elem )) {
					return adapter;
				}
			}
		}
	}

	hm.activity.get.getViewValue = function( e ) {
		//e.handler.getViewValue is initialized when on subscription
		return e.handler.getViewValue( e.publisher, e );
	};

	hm.activity.set.setViewValue = function( value, e ) {
		//e.handler.setViewValue is initialized when on subscription
		return e.handler.setViewValue( this, value, e );
	};

	function initAdapterMethodForView( model, view, handler, adapterName, methodName ) {

		var adapter = findValueAdapter( view, adapterName );

		if (!adapter || !adapter[methodName]) {

			throw "can not find " + methodName + " method for view";
		}

		//create handler.getViewValue or handler.setViewValue
		handler[methodName + "ViewValue"] = adapter[methodName];

		if (adapter.convert) {
			handler.convert = adapter.convert;
		}

		//we want to run the initialize method only once
		if (!view.hmData( "valueBound" )) {

			adapter.initialize && adapter.initialize( view, model.get() );

			//when "reset" event is trigger to parent form, the children does
			//not trigger the event, so that we need to trigger "resetVal" to update
			//back the original value to modal
			view.parents( "form" ).bind( "reset", function() {

				setTimeout( function() {
					view.triggerHandler( "resetVal" );
				}, 10 );
			} );

			view.hmData( "valueBound", true );

		}
	}

	hm.workflow( {

		//set view value with model value
		updateViewValue: {
			initialize: function( publisher, subscriber, workflow, adapterName ) {
				//subscriber is view, trying to getModel setView
				initAdapterMethodForView( publisher, subscriber, workflow, adapterName, "set" );

			},
			get: "get",
			set: "*setViewValue"
		},

		//set model value with view value
		updateModelValue: {

			initialize: function( publisher, subscriber, workflow, adapterName ) {
				//publisher is view, trying to getView setModel
				initAdapterMethodForView( subscriber, publisher, workflow, adapterName, "get" );

			},
			get: "*getViewValue",
			set: "set"
		}
	} );

	//add value adapter
	//the last added using the method, will be evaluated first
	/*
	 //a view adapter is is like
	 {
	 //optional if match function is present
	 name: "adapterName",
	 //
	 //optional if name is present
	 match: function ($elem) { return true; },
	 //
	 //prepare $element
	 initialize: function ($elem) {}
	 //
	 //get a value from element
	 get: function ($elem) {},
	 //
	 //set a value to $element
	 set: function( $elem, value ) {},
	 //
	 //optional, if get function already convert, you don't need this
	 convert: "*commonConvertActivityName" or function (value) {}

	 }
	 * */
	hm.valueAdapter = function( adapter ) {
		if (adapter) {
			valueAdapters.push( adapter );
		} else {
			return valueAdapters;
		}
	};

	//dynamic group
	//support the following
	//
	//val:path
	//val:path|keypress
	//val:path|,updateModel
	//val:path|,updateView
	//val:path|,,date
	//val:path|updateEvent,updateDirection,adapterName
	bindings( {
		val: function( elem, path, context, options ) {

			var updateTarget,
				updateEvent,
				adapterName;

			options = options || "";

			if (!options) {
				updateEvent = "change";
			} else {
				options = options.split( "," );
				updateEvent = options[0] || "change"; //by default it is "change"
				updateTarget = options[1]; //undefined, updateView or updateModel
				adapterName = options[2];
			}

			if (!updateTarget || updateTarget == "view") {
				context.appendSub( elem, path, "init1 after*", "*updateViewValue", adapterName );
			}

			if (!updateTarget || updateTarget == "model") {

				//when form is reset, the default behavior of the html form value is reset
				// to value specify "value" attribute, however the change event does not trigger,
				//
				//so we need to use a special event "resetVal" which is triggered
				// when the parent form element is triggered
				// by using this event, we want to update model from the view value
				context.prependSub( path, elem, updateEvent + " resetVal", "*updateModelValue", adapterName );

			}
		}
	} );



//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>


	defaultOptions.confirmMessage = "Are you sure?";

	function addBindingAndWorkflowType( features ) {
		for (var name in features) {
			var item = features[name];
			bindings( name, item[0] );
			hm.workflow( name, item[1] );
		}
	}

	hm.activity.get.compareTruthy = function( e ) {
		var expression = e.handler.options,
			publisher = e.publisher;
		return isUndefined( expression ) ?
			!publisher.isEmpty() :
			publisher.compare( expression );
	};

	hm.activity.initialize.extractClass = function( publisher, subscriber, workflow, options ) {
		var parts = options.split( "," );
		workflow.className = parts[0];
		workflow.options = parts[1];
	};

	addBindingAndWorkflowType( {

		//--------changing view----------
		options: [
			"!init after*:.|*options",
			//add model workflows
			//render <select> options
			//<select options="modelPath">
			//<select options="modelPath|propertyName">
			//<select options="modelPath|textColumn,valColumn">
			{
				//this is actually the execute function, in this workflow
				//there is no set, the content of the view is render
				//in the get function.
				get: function( e ) {
					var options = e.handler.options,
						subscriber = this,
						value = subscriber.val();

					subscriber.children( "option[listItem]" )
						.remove().end().append(
						function() {
							var html = "";
							$( e.publisher.get() ).each( function() {
								html += "<option listItem='1' value='" + options.value( this ) + "'>" + options.name( this ) + "</option>";
							} );
							return html;
						} ).val( value );

					if (subscriber.val() !== value) {
						$( subscriber.trigger( "change" ) );
					}
				},

				initialize: function( publisher, subscriber, workflow, options ) {
					if (options) {

						var parts = options.split( "," ),
							textColumn = parts[0],
							valueColumn = parts[1] || parts[0];

						workflow.options = {
							name: function( item ) {
								return item[textColumn];
							},
							value: function( item ) {
								return item[valueColumn];
							}
						};

					} else {

						workflow.options = {
							name: function( item ) {
								return item.toString();
							},
							value: function( item ) {
								return item.toString();
							}
						};
					}
				}
			}
		],

		show: [

			//data-sub="`show:path"
			"!init after*:.|*show",

			{

				get: "*compareTruthy",

				set: function( truthy ) {

					this[truthy ? "show" : "hide"]();

				}
			}

		],

		hide: [

			"!init after*:.|*hide",

			{
				get: "*compareTruthy",

				//use subscription group instead
				set: function( truthy ) {

					this[ truthy ? "hide" : "show"]();
				}
			}
		],

		enable: [

			"!init after*:.|*enable",

			{
				get: "*compareTruthy",

				set: function( truthy ) {

					this.attr( "disabled", !truthy );
				}
			}
		],

		disable: [

			"!init after*:.|*disable",
			{
				get: "*compareTruthy",

				set: function( truthy ) {
					this.attr( "disabled", truthy );
				}
			}
		],

		addClass: [

			"!init after*:.|*addClass",
			{

				initialize: "*extractClass",

				get: "*compareTruthy",

				set: function( truthy, e ) {

					this[truthy ? "addClass" : "removeClass"]( e.handler.className );
				}
			}
		],

		removeClass: [

			"!init after*:.|*removeClass", {

				initialize: "*extractClass",

				get: "*compareTruthy",

				set: function( truthy, e ) {

					this[truthy ? "removeClass" : "addClass"]( e.handler.className );

				}
			}
		],

        //the class name can be passed as options parameter
        //or the class name is the value of the model
        //
        //toggle-class="model"
        //or
        //<p !afterUpdate="isHappy|*fakeGet toggleClass*happy" ></p>
		toggleClass: [

			"!init after*:.|*toggleClass", {

				get: function( e ) {
					var method,
						reverse,
						value = e.publisher.get(),
						className = e.handler.options;

					if (className) {
						if (className.startsWith( "!" )) {
							reverse = true;
							className = className.substr( 1 );
						}

						method = value ^ reverse ? "addClass" : "removeClass";
					}

					if (e.type == "init") {

						if (className) {

							this[method]( className );

						} else {

							this.addClass( value );
						}

					} else {
						if (className) {

							this[method]( className );

						} else {

							this.removeClass( e.removed ).addClass( value );

						}
					}
				}
			}
		],

		//focus:*isEditMode
		//focus on a view if model is not empty
		focus: [
			"!init after*:.|*focus",
			{
				get: "*compareTruthy",

				set: function( truthy, e ) {

					if (truthy) {
						var subscriber = this;
						setTimeout( function() {
							subscriber.focus().select();
						}, 1 );
					}
				}
			}
		],

		count: [

			"!init after*:.|*count",

			function( e ) {
				var value = e.publisher.get(),
					count = ( "length" in value) ? value.length : value;

				this.text( count );
			}
		],

		dump: [

			"!init *:.|*dump",

			function( e ) {
				if (!e.type.startsWith( "before" )) {
					this.html( "<span style='color:red'>" + e.publisher.path + " : " + e.publisher.toJSON() + "</span>" );
				}
			}
		],

		//alert:path //this will alert the data in model
		//alert:_|hello world //this will alert "hello world"
		alert: [

			"$click:.|*alert",

			function( e ) {
				alert( isUndefined( e.handler.options ) ? this.get() : e.handler.options );
			}

		],

		log: [

			"$click:.|*log",

			function (e) {
				hm.log( isUndefined( e.handler.options ) ? this.get() : e.handler.options );
			}
		],
		preventDefault: [

			"$click:_|*preventDefault",

			function( e ) {
				e.preventDefault();
			}
		],

		stopPropagation: [

			"$click:_|*stopPropagation",

			function( e ) {
				e.stopPropagation();
			}
		],

		//confirm:_
		//confirm:path
		//confirm:_|your message
		confirm: [

			//replacing "$click:.|*confirm", with dynamic binding,
			//so that it can be fix the problem caused by mapEvent
			//as long as it is placed before mapEvent dynamic binding
			function( elem, path, binding, options ) {
				hm.sub( path, elem, "click", "*confirm", options );
			},

			function( e ) {

				var message = isUndefined( e.handler.options ) ?
					this && this.path && this.get && this.get() || defaultOptions.confirmMessage :
					e.handler.options;

				if (!confirm( message )) {
					e.stopImmediatePropagation();
					e.preventDefault && e.preventDefault();
				}
			}
		],

		///------changing model------------
		setTo: [
			"$click:.|*setTo",
			{
				initialize: function( publisher, subscriber, workflowInstance, options ) {
					workflowInstance.setTo = toTypedValue( options );
				},
				get: function( e ) {
					this.set( e.handler.setTo );
				}
			}
		],

		"0": [
			"$click:.|*0",
			function( /*e*/ ) {
				this.set( 0 );
			}
		],

		emptyString: [
			"$click:.|*empty",
			function( /*e*/ ) {
				this.set( "" );
			}
		],

		"null": [
			"$click:.|*null",

			function( /*e*/ ) {
				this.set( null );
			}
		],

		"true": [

			"$click:.|*true",

			function( /*e*/ ) {
				this.set( true );
			}
		],

		"++": [
			"$click:.|*++",

			function( /*e*/ ) {
				this.set( this.get() + 1 );
			}
		],

		"--": [
			"$click:.|*--",
			function( /*e*/ ) {
				this.set( this.get() - 1 );
			}
		],

		"false": [
			"$click:.|*false",
			function( /*e*/ ) {
				this.set( false );
			}
		],

		toggle: [

			"$click:.|*toggle",
			function( /*e*/ ) {
				var subscriber = this;
				subscriber.set( !subscriber.get() );
			}
		],

		sortItems: [
			"$click:.|*sortItems",
			{
				initialize: function( publisher, subscriber, workflow, options ) {
					options = (options || "") && options.split( "," );
					workflow.by = options[0];
					//because options[1] default is undefined
					//so asc is by default
					workflow.asc = !!options[1];
				},
				get: function( e ) {
					var workflow = e.handler;
					this.sort( workflow.by, workflow.asc );
					workflow.asc = !workflow.asc;
				}
			}
		],

		clear: [

			"$click:.|*clear",

			function( /*e*/ ) {
				this.clear();
			}
		],

		del: [
			"$click:.|*del;confirm:_|_Do you want to delete this item?",

			function( /*e*/ ) {
				this.del();
			}
		]
	} );

	bindings( {

		caption: function( elem, path, context, options ) {

			$( elem ).prepend( "<option value=''>" + (options || hm.get( path ) || "") + "</option>" );
		},

		autofocus: function( elem ) {
			setTimeout( function() {
				$( elem ).focus();
			}, 1 );
		},

		mapEvent: function( elem, path, context, options ) {
			options = options.split( "," );
			$( elem ).mapEvent( options[0], options[1], options[2] );

		},

		mapClick: function( elem, path, context, options ) {
			options = options.split( "," );
			$( elem ).mapEvent( "click", options[0], options[1] );
		},

		logPanel: function( elem, path, context, options ) {

			$( elem ).css( "list-style-type", "decimal" ).css( "font-family", "monospace, serif" );

			context.appendSub( elem, "*log", "init", function( e ) {
				var allLogs = e.publisher.get();
				for (var i = 0; i < allLogs.length; i++) {
					this.append( "<li>" + allLogs[i] + "</li>" );
				}
			} );

			context.appendSub( elem, "*log", "afterCreate.1", function( e ) {
				this.append( "<li>" + e.originalPublisher.raw() + "</li>" );
			} );

			context.appendSub( elem, "*log", "afterCreate", function( e ) {
				this.empty();
			} );
		},

		clearlog: "clear:/*log",

		//data-sub="enableLater:path"
		enableLater: "!after*:.|*enable",

		//data-sub="disableLater:path"
		disableLater: "!after*:.|*disable",

		//data-sub="html:path"
		html: "!init after*:.|get html *toString",

		//data-sub="text:path"
		text: "!init after*:.|get text *toString",

		removeIfDel: "!duringDel:.|*fakeGet remove",

		emptyIfDel: "!duringDel:.|*fakeGet empty"

	} );

	hm.newJqEvent( {

		enter: ["keyup", function( e ) {
			return (e.keyCode === 13);
		}],

		esc: ["keyup", function( e ) {
			return (e.keyCode === 27);
		}],

		ctrlclick: ["click", function( e ) {
			return e.ctrlKey;
		}]
	} );



//
/*
 <@depends>
 subscription.js,
 model.js
 </@depends>
 */


	var methodMap = {
		"create": "POST",
		"update": "PUT",
		"destroy": "DELETE",
		"fetch": "GET"
	};

	var entityState = {
		detached: 0,
		unchanged: 1,
		added: 3,
		deleted: 4,
		modified: 5
	};

	function markModified ( e ) {

		var basePath = this.path; //items
		var originalPath = e.originalPublisher.path; //items.1.firstName
		var diffPath = originalPath.substr( basePath.length + 1 ); //1.firstName
		var dotIndex = diffPath.indexOf( "." );
		var entityPath = basePath + "." + diffPath.substr( 0, dotIndex ); //items.1
		var statePath = entityPath + ".__state"; //items.1.__state

		if (originalPath !== statePath &&
		    hm.get( statePath ) == entityState.unchanged) {
			//use set method is deliberate, because we want
			//to raise event
			hm.set( statePath, entityState.modified );
		}
	}

	hm.onAddOrUpdateNode( function( context, index, value ) {
		if (value instanceof hm.Entity) {

			if (value.__state === entityState.detached) {
				value.__state = entityState.added;
			}

			if (isUndefined( hm( context ).get( "__entityContainer" ) )) {
				hm.sub( context, context, "afterUpdate.*", markModified );
				hm( context ).set( "__entityContainer", true );
			}
		}
	} );

	function callStaticAjaxMethod ( node, methodName ) {
		var entity = node.get();

		return entity.constructor[methodName]( entity ).done( function( data ) {

			node.set(

				"__state",

				methodName == "destroy" ?
					entityState.detached :
					entityState.unchanged
			);

			node.trigger( "afterSync." + methodName );
		} );
	}

	//the reason that we don't implement ajax in the instance method is that, we want to
	//support the call from repository node, such node.set("create"), node.set("update")..
	//we want to delegate this call the static method
	hm.Entity = hm.Class.extend(
		//instance method, which is invoked by node.get method
		//or it can be invoked the object directly
		{
			//this state is meaningful only when it entity is inside of repository
			__state: entityState.detached,

			create: function __ () {
				if (this instanceof hm) {
					if (this.get( "__state" ) == entityState.added) {
						return callStaticAjaxMethod( this, "create" );
					}
					throw "entity is not a new item";

				} else {
					// don't use Entity.create(this), because
					// this.constructor is not necessary Entity
					return this.constructor.create( this );

				}
			},

			fetch: function __ () {
				return this instanceof hm ? callStaticAjaxMethod( this, "fetch" ) :
					this.constructor.fetch( this );
			},

			update: function __ () {

				if (this instanceof hm) {
					if (this.get( "__state" ) == entityState.modified) {
						return callStaticAjaxMethod( this, "update" );
					}
				} else {
					return this.constructor.update( this );
				}
			},

			destroy: function __ () {
				if (this instanceof hm) {
					var node = this;
					return callStaticAjaxMethod( this, "destroy" ).done( function() {
						node.del();
					} );
				} else {
					return this.constructor.destroy( this );
				}
			},

			save: function __ () {
				if (this instanceof hm) {

					var state = this.get( "__state" );
					if (state == entityState.added) {

						return this.get( "create" );

					} else if (state == entityState.modified) {

						return this.get( "update" );
					}

				} else {

					throw "not supported";
				}

			}

		},

		//static method, which knows nothing about repository
		{
			state: entityState,

			create: function( instance ) {
				return this.ajax( "create", instance );
			},

			update: function( instance ) {
				return this.ajax( "update", instance );
			},
			destroy: function( instance ) {
				return this.ajax( "destroy", instance );
			},

			fetch: function( instance ) {
				if (instance) {
					return this.ajax( "fetch", instance );
				} else {
					var Constructor = this;
					//the pipe method is used to convert an array of
					// generic object into an array of object of the same "Class"
					return this.ajax( "fetch" ).pipe( function( data ) {
						return $( Constructor.list( data ) ).each(function() {
							this.__state = entityState.unchanged;
						} ).get();
					} );

				}
			},

			getUrl: function( methodName, instance ) {
				var baseUrl = this.url || instance.url,
					id = instance && instance.id;

				return id ? baseUrl + (baseUrl.charAt( baseUrl.length - 1 ) === '/' ? '' : '/') + encodeURIComponent( id ) :
					baseUrl;
			},

			ajax: function( methodName, instance ) {
				var method = methodMap[methodName];

				var ajaxOptions = {
					type: method,
					dataType: 'json',
					url: this.getUrl( methodName, instance ),
					contentType: method == "GET" ? null : "application/json",
					processData: false,
					data: method == "GET" ? null : JSON.stringify( instance )
				};

				return $.ajax( ajaxOptions ).done( function( response ) {
					instance && extend( instance, response );
				} );
			}
		} );

	extend( hmFn, {

		//node function which bridget the hm method to the static method of model
		//subPath is optional
		//method is required create/read/update/del
		//e.g node.sync("create");
		save: function() {
			return this.get( "save" );
		},

		destroy: function() {
			return this.get( "destroy" );
		},

		fetch: function() {
			return this.get( "fetch" );
		}
	} );

//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>


	defaultOptions.errors = {
		defaultError: "Please enter a valid value"
	};

	var afterUpdateAndCheckValidity = "afterUpdate* checkValidity",
		invalidPaths = shadowRoot.invalidPaths = [],
		invalidPathsModel = hm( "*invalidPaths" ),
		rEmpty = /^\s*$/,
		rEmail = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i,
		rUrl = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i,
		rDateISO = /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,
		rNumber = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/,
		rDigit = /^\d+$/,
		rInvalidDate = /Invalid|NaN/,
		rRegEx = /^(\/(\\[^\x00-\x1f]|\[(\\[^\x00-\x1f]|[^\x00-\x1f\\\/])*\]|[^\x00-\x1f\\\/\[])+\/[gim]*)(,(.*))*$/,
		rFirstToken = /([^,]+)(,(.*))?/,
		rFirstTwoToken = /(\w+),(\w+)(,(.*))?/;

	/*	this method is to create a subscription group and
	 workflow type using the name of validator
	 and also add a class rule using the name of validator
	 so make sure the name of validator do not collide with other validator

	 a validator is object like
	 {
	 name: "validatorName",
	 error: "error message"
	 isValid: function( value, options ); // options let user to help the isValid to work better
	 initialize: function(options); //allow user convert string value of modelEvent.options to the options passed in isValid function
	 buildError: function(defaultMessage, options )
	 }
	 */
	hm.validator = function( validator ) {

		if (isArray( validator )) {
			for (var i = 0; i < validator.length; i++) {
				hm.validator( validator[i] );
			}
			return this;
		}

		var validatorName = validator.name;

		if (hm.workflow( validatorName )) {
			throw "validator name '" + validatorName + "' collide with name in hm.workflowTypes";
		}

		//add default error if applicable
		//user can localize errors message
		if (validator.error) {
			defaultOptions.errors[validatorName] = validator.error;
		}

		if (validator.isValid instanceof RegExp) {
			validator.isValid = buildRegexFn( validator.isValid );
		}

		var workflowTypeName = "v_" + validatorName;
		hm.workflow( workflowTypeName, buildValidationWorkflowType( validator ) );

		//data-sub="required:path" or data-sub="required:path|options"
		bindings( validatorName, "!afterUpdate checkValidity:.|*" + workflowTypeName );

	};

	hm.workflow( {
		checkValidity: function( e ) {
			if (!hm.checkValidity( this.path )) {
				//because it is the first handler, e.stopImmediatePropagation will
				//stop process all other handler
				e.stopImmediatePropagation();
			}
		},

		// use by group
		// warn: "!after*:*errors|*warn",
		warn: function( e ) {
			//e.publisher points to "model*errors"
			if (e.publisher.isEmpty()) {

				this
					.removeClass( "error" )
					.next( "span.error" )
					.remove();

			} else {

				this
					.addClass( "error" )
					.next( "span.error" )
					.remove()
					.end()
					.after( "<span class='error'>" + e.publisher.get() + "</span>" );
			}
		},

		highlightError: function( e ) {
			this[e.publisher.isEmpty() ? "removeClass" : "addClass"]( "error" );

		},

		renderErrorSummary: hm.template.newTemplateHandler(
			function( e ) {
				return [e.publisher.getErrors()];
			}
		)
	} );

	bindings( {

		validator: function( elem, path, context, options ) {
			if (!options) {
				throw "missing validator path";
			}
			if (!options.startsWith( "#" )) {
				options = "#" + options;
			}
			hm( path ).validator( options );
		},

		//add a click handler to element to checkValidity
		checkValidity: function( elem, path, context, options ) {
			//prepend to to subscriptions array
			//so that it is the first subscriptions, and it will be evaluated first
			context.prependSub( path, elem, "click", "*checkValidity" );
		},

		resetValidity: "$click:.|*fakeGet resetValidity",

		warn: "!after*:*errors|*warn",

		"highlightError": "!after*:*errors|*highlightError",

		warnSummary: "!afterUpdate* validityChecked:.|*renderErrorSummary;!validityReset:.|empty"

	} );

	bindings( "form", function( elem, path, context, options ) {
		context.appendSub( path, elem, "reset", "*fakeGet resetValidity" );
	}, true );

	function isPathValid( path ) {

		if (path === "") {
			return !invalidPaths.length;
		}

		var prefix = path + ".";

		for (var i = 0, invalidPath, length = invalidPaths.length; i < length; i++) {
			invalidPath = invalidPaths[i];
			if (invalidPath == path || invalidPath.startsWith( prefix )) {
				return false;
			}
		}
		return true;
	}

	//$("x").subscribe("person", "checkValidityd", function (e) {
	// alert(e.proposed);
	//}
	hm.subscription.special.validityChanged = {
		setup: function( subscriber, publisher ) {
			var isValidPath = publisher + "*isValid";

			if (isUndefined( hm.get( isValidPath ) )) {
				hm.sub( publisher, "*invalidPaths", "!after*. after*.1", function() {
					var isValid = isPathValid( publisher );
					if (hm.get( isValidPath ) !== isValid) {
						hm.trigger( publisher, publisher, "validityChanged", isValid, !isValid );
						hm.set( isValidPath, isValid );
					}
				} );
			}
		}
	};

	extend( hmFn, {

		/*
		 * 1. the objects in path "*invalidPaths", it holds all the path of model which is in error
		 * 2. the object in path "model*errors", it holds all error message that is
		 * */
		checkValidity: function( subPath ) {

			var fullPath = this.getPath( subPath ); // this.cd( subPath ).path;

			traverseModelNeedValidation( fullPath, function( path ) {
				trigger( path, path, "checkValidity", rootNode.get( path ) );
			} );

			//after checkValidity fired, we can check the invalid paths count for the model,
			var isValid = isPathValid( fullPath );
			//
			hm.trigger( fullPath, fullPath, "validityChecked", isValid );

			return isValid;
		},

		//hm("x").check(validatorName, error)
		//example
		//hm("x").check("number", "my error message")
		//
		//hm("x").check(fnIsValid, error)
		//example
		//hm("x").check(function( value ) { return false; }, "my error message");
		validator: function( validator, options ) {
			var subPath,
				i,
				currentValidator;

			if (isObject( validator )) {

				for (subPath in validator) {

					this.cd( subPath ).validator( validator[subPath] );

				}
			} else {

				if (isFunction( validator ) || (isString( validator ) && validator.startsWith( "#" ))) {

					if (isString( validator )) {
						validator = this.raw( validator.substr( 1 ) );
					}

					hm.handle( this.path, afterUpdateAndCheckValidity, function( e ) {
						var publisher = e.publisher,
							previousError = validator.previousError;

						//don't check when it is empty
						if (!isEmptyString( e.proposed )) {

							var errorMessage = validator( publisher.get() );

							if (errorMessage === false) {
								errorMessage = defaultOptions.errors.defaultError;
							}

							if (isString( errorMessage )) {
								// the "!=" is deliberate, don't change to "!=="
								if (errorMessage != previousError) {

									publisher.addError( errorMessage );

									if (!previousError) {
										publisher.removeError( previousError );
									}

									validator.previousError = errorMessage;
								}

							} else {
								if (previousError) {
									publisher.removeError( previousError );
									validator.previousError = "";
								}
							}
						} else {
							if (previousError) {
								publisher.removeError( previousError );
								validator.previousError = "";
							}
						}

					} );

				} else if (isString( validator )) {

					hm.handle( this.path, afterUpdateAndCheckValidity, "*v_" + validator, options );

				} else if (isArray( validator )) {

					for (i = 0; i < validator.length; i++) {

						currentValidator = validator[i];

						if (isArray( currentValidator )) {
							this.validator( currentValidator[0], currentValidator[1] );

						} else {
							this.validator( currentValidator );
						}
					}
				}

			}
			return this;
		},

		resetValidity: function() {
			resetValidity( this.path );

			if (!isPrimitive( this.get() )) {
				traverseModelNeedValidation( this.path, resetValidity );
			}
			hm.trigger( this.path, this.path, "validityReset" );
		},

		addError: function( error ) {
			this.createIfUndefined( "*errors", [] )
				.cd( "*errors" )
				.pushUnique( error );

			invalidPathsModel.pushUnique( this.path );
			return this;

		},

		removeError: function( error ) {

			var errors = this.createIfUndefined( "*errors", [] ).cd( "*errors" );
			errors.removeItem( error );
			if (errors.isEmpty()) {
				invalidPathsModel.removeItem( this.path );
			}
			return this;
		},

		getErrors: function() {

			var i,
				path = this.path,
				invalidPath,
				rtn = [];

			for (i = 0; i < invalidPaths.length; i++) {
				invalidPath = invalidPaths[i];
				if (invalidPath == path || invalidPath.startsWith( path )) {
					rtn = rtn.concat( hm.get( invalidPath + "*errors" ) );
				}
			}
			return rtn;
		}

	} );

	hm.checkValidity = function( path ) {
		return rootNode.checkValidity( path );
	};

	//when path is deleted, remove it from invalidPathsModel
	hm.onDeleteNode( function( path ) {
		invalidPathsModel.removeItem( path );
	} );

	function buildRegexFn( ex, reverse ) {
		return reverse ? function( value ) {
			return !ex.test( value );
		} : function( value ) {
			return ex.test( value );
		};
	}

	function defaultErrorBuilder( format, options ) {
		return options.error || format.supplant( options );
	}

	hm.validator.defaultErrorBuilder = defaultErrorBuilder;
	hm.validator.buildRegexFn = buildRegexFn;

	hm.validator( [
		{
			name: "required",
			error: "This field is required.",
			//when it is checked it is always true
			isValid: returnTrue
		},
		{
			name: "email",
			error: "Please enter a valid email address.",
			isValid: rEmail
		},
		{
			name: "url",
			error: "Please enter a valid URL.",
			isValid: rUrl
		},
		{
			name: "date",
			error: "Please enter a valid date.",
			isValid: function( value ) {
				return !rInvalidDate.test( new Date( value ).toString() );
			}
		},
		{
			name: "dateISO",
			error: "Please enter a valid date (ISO).",
			isValid: rDateISO
		},
		{
			name: "number",
			error: "Please enter a valid number.",
			isValid: rNumber
		},
		{
			name: "digits",
			error: "Please enter only digits.",
			isValid: rDigit

		},
		{
			name: "creditcard",
			error: "Please enter a valid credit card number.",
			isValid: function( value ) {
				if (/[^0-9\-]+/.test( value )) {
					return false;
				}

				var nCheck = 0,
					nDigit = 0,
					bEven = false,
					cDigit;

				value = value.replace( /\D/g, "" );

				for (var n = value.length - 1; n >= 0; n--) {
					cDigit = value.charAt( n );
					nDigit = parseInt( cDigit, 10 );
					if (bEven) {
						if ((nDigit *= 2) > 9) {
							nDigit -= 9;
						}
					}
					nCheck += nDigit;
					bEven = !bEven;
				}

				return (nCheck % 10) === 0;
			}

		},
		{
			name: "minlength",
			error: "Please enter at least {minlength} characters.",
			isValid: function( value, options ) {

				return value.length >= options.minlength;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {

					handler.options = {
						minlength: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for minlength validator";
				}
			},

			buildError: defaultErrorBuilder
		},
		{
			name: "maxlength",
			error: "Please enter no more than {maxlength} characters.",
			isValid: function( value, options ) {

				return value.length <= options.maxlength;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {
					handler.options = {
						maxlength: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for maxlength validator";
				}
			},
			buildError: defaultErrorBuilder
		},
		{
			name: "rangelength",
			error: "Please enter a value between {minlength} and {maxlength} characters long.",
			isValid: function( value, options ) {

				return value.length >= options.minlength &&
				       value.length <= options.maxlength;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstTwoToken.exec( options ))) {
					handler.options = {
						minlength: +match[1],
						maxlength: +match[2],
						error: match[4]
					};
				} else {
					throw "invalid options for rangelength validator";
				}
			},
			buildError: defaultErrorBuilder

		},
		{
			name: "min",
			error: "Please enter a value greater than or equal to {min}.",
			isValid: function( value, options ) {

				return value >= options.min;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {
					handler.options = {
						min: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for min validator";
				}

			},
			buildError: defaultErrorBuilder
		},
		{
			name: "max",
			error: "Please enter a value less than or equal to {max}.",
			isValid: function( value, options ) {

				return value <= options.max;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {
					handler.options = {
						max: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for max validator";
				}
			},
			buildError: defaultErrorBuilder
		},
		{
			name: "range",
			error: "Please enter a value between {min} and {max}.",
			isValid: function( value, options ) {

				return value >= options.min && value <= options.max;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstTwoToken.exec( options ))) {
					handler.options = {
						min: +match[1],
						max: +match[2],
						error: match[4]
					};
				} else {
					throw "invalid options for range validator";
				}
			},
			buildError: defaultErrorBuilder
		},
		{
			name: "equal",
			error: "Please enter the same value again.",
			isValid: function( value, options ) {
				return rootNode.get( options.comparePath ) === value;
			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {

					var comparePath = publisher.cd( match[1] ).path;
					handler.options = {
						comparePath: comparePath,
						error: match[3]
					};

					publisher.sub( comparePath, "afterUpdate", function( e ) {
						if (!this.isEmpty()) {
							trigger(
								this.path,
								this.path,
								"checkValidity",
								this.get() //proposed value
							);
						}
					} );

				} else {
					throw "invalid options for equal validator";
				}
			}
		},
		{
			name: "regex",
			error: "Please enter a value match with required pattern.",
			isValid: function( value, options ) {
				return options.regex.test( value );
			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;

				if (options && (match = rRegEx.exec( options ))) {
					handler.options = {
						regex: eval( match[1] ),
						error: match[5]
					};
				} else {
					throw "invalid options for regex validator";
				}
			}
		},
		{
			name: "fixedValue",
			error: 'Please enter value "{fixedValue}"',
			isValid: function( value, options ) {
				return value == options.fixedValue;
			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (isString( options )) {
					match = /^(\w+)(,(.*))*$/.exec( options );
					if (match) {
						handler.options = {
							fixedValue: toTypedValue( match[1] ),
							error: match[3]
						};
					}
				} else if (isObject( options )) {

					handler.options = options;

				} else if (!isUndefined( options )) {

					handler.options = {
						fixedValue: options
					};

				} else {
					throw "missing options in fixedValue validator";
				}
			},
			buildError: defaultErrorBuilder
		}
	] );

	function resetValidity( path ) {
		var errorsModel = hm( path + "*errors" );
		if (!errorsModel.isEmpty()) {
			errorsModel.clear();
			invalidPathsModel.removeItem( path );
		}
	}

	var isRequired = hm.workflow( "v_required" ).get;

	function isModelRequired( path ) {
		var subscriptionByModel = hm( path ).subsToMe();// subscriptions.getByPublisher( path );
		for (var i = 0; i < subscriptionByModel.length; i++) {
			var subscription = subscriptionByModel[i];
			if (subscription.handler.get === isRequired) {
				return true;
			}
		}
		return false;
	}

	function buildErrorMessage( validator, options ) {

		//named validator normally has a defaultError
		var defaultError = validator.name && defaultOptions.errors[validator.name];

		//if validator has buildError function, this take the highest priority
		if (validator.buildError) {

			//return userError || format.apply( null, [defaultError].concat( options.minlength ) );
			return validator.buildError( defaultError, options );

			//if defaultError is format string,
		} else {

			//userError is normally passed in options of each instance
			var userError = isObject( options ) ? options.error : options;

			if (defaultError && defaultError.contains( "{0}" )) {

				return defaultError.format.apply( defaultError, userError.split( "," ) );

			} else {

				return userError || defaultError || validator.error;
			}
		}
	}

	function buildValidationWorkflowType( validator ) {

		return {

			initialize: validator.initialize,

			get: function( e ) {

				//if it violate required rule, don't do further validation,
				//as we expect the required rule will capture it first.
				var isValid,
					violateRequiredRule,
					publisher = e.publisher,
					options = e.handler.options,
					proposed = e.proposed,
					errorMessage = buildErrorMessage( validator, options );

				//if model is empty, only check the "require" validator
				//If it is required, then it is invalid, no further validation is checked
				//if it is not required, it is valid, no further validation is checked
				if (isEmptyString( proposed )) {

					if (isModelRequired( publisher.path )) {
						isValid = false;
						violateRequiredRule = true;
					} else {
						isValid = true;
					}

				} else {

					isValid = validator.isValid( proposed, options );
				}

				if (!isValid) {

					//add error when the current rule is the "required rule"
					//or when "required" rule is not violated
					if (!violateRequiredRule || validator.name === "required") {
						publisher.addError( errorMessage );
					} else {
						publisher.removeError( errorMessage );
					}
				} else {
					publisher.removeError( errorMessage );
				}
			}
		};
	}

	function traverseModelNeedValidation( path, callback ) {

		//the following code try to trigger the "checkValidity" event, so that the validator will
		// be called to check current value of the model
		//you can not call afterUpdate, because there might trigger other non-validator handler
		//that are attached to afterUpdate
		var allSubscriptions = hm.subscription.getAll();
		var checkValiditydPaths = {};

		for (var i = allSubscriptions.length - 1, subscription, publisherPath; i >= 0; i--) {

			subscription = allSubscriptions[i];
			publisherPath = subscription.publisher;

			var isValidationRequired =
				isString( publisherPath ) && !checkValiditydPaths[publisherPath] &&
				publisherPath.startsWith( path ) &&
				subscription.eventTypes.contains( "checkValidity" );

			if (isValidationRequired) {

				checkValiditydPaths[publisherPath] = true;
				callback( publisherPath );

			}
		}
	}

	function isEmptyString( value ) {
		return value === null || value === undefined || rEmpty.test( value );
	}

//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>


	//the convention here is that ,
	// use rowView for the row in view
	//use item for the item in model array

	hm.workflow( {

		//----------workflow type which modify row in list view-----------

		//!afterCreate.1:array|*addRowView;
		addRowView: newTemplateHandler(

			//the reason to use getOriginal is that
			//the subscription is the items array
			//but here we want to the elem
			"*getOriginal",

			function( rowView, e ) {

				var rowContainer = this,
					rows = rowContainer.children();

				if (rows.length === 0) {

					rowContainer.append( rowView );

				} else {

					//the insert may not happen at the end of the array
					//at can be insert in the middle, so
					//we can not simply do subscriber.append()
					//we need to append the row view at the index
					var index = +e.originalPublisher.pathIndex();

					//row zero is special, need to use before method
					if (index === 0) {

						rows.eq( 0 ).before( rowView );
					} else {
						rows.eq( index - 1 ).after( rowView );
					}
				}
			}
		),

		//!afterUpdate.1:array|*updateRowView
		updateRowView: newTemplateHandler(

			"*getOriginal",

			function( value, e ) {
				this.children().eq( +e.originalPublisher.pathIndex() ).replaceWith( value );
			} ),

		//!afterDel.1:array|*removeRowView;
		removeRowView: function( e ) {
			this.children().eq( +e.originalPublisher.pathIndex() ).remove();
		}


	} );

	//autoQuery means user don't need to trigger search button
	//query result will automatically updated when
	//query change, by default it is false
	//which means user has refreshQuery manually
	hmFn.enableQuery = function( autoQuery ) {

		if (this.get( "*query" )) {
			return this;
		}

		var queryable,
			query,
			sort,
			pager,
			filterFn,
			filter,
			items = this.get(),
			queryNode = this.cd( "*query" ),
			queryResultNode = this.cd( "*queryResult" ),
			hasQueryResultNode = this.cd( "*hasQueryResult" ),
			pagerNode = queryNode.cd( "pager" ),
			filterNode = queryNode.cd( "filter" ),
			filterEnabledNode = filterNode.cd( "enabled" ),
			sortNode = queryNode.cd( "sort" );

		autoQuery = !!autoQuery;

		if (autoQuery) {
			//items*queryResult ---referencing--> items*query
			queryResultNode.watch( queryNode.path );
		}

		//items*queryResult --> items
		queryResultNode.watch( this.path );

		this.extend(
			"*",
			queryable = {

				//if it is true, refreshQuery is bypassed
				autoQuery: autoQuery,

				hasQueryResult: false,

				//the object holding the data about paging, sorting, and filtering
				query: query = {
					pager: pager = {
						enabled: false,
						index: 0, //nth page
						count: 1,
						size: 0
					},
					sort: sort = {
						by: null, //currently we only support sort by one column sort
						asc: null
					},
					filter: filter = {
						by: "",
						value: "",
						ops: "",
						enabled: false
					},
					//is query enabled
					enabled: function() {
						return this.get( "pager.enabled" ) || this.get( "sort.by" ) || this.get( "filter.enabled" );
					}
				},

				queryResult: function( disablePaging ) {

					//"this" refers to the queryable node but not the queryable object
					var $items = $( items ),

					//run filter
						rtn = filterFn ? $items.filter( filterFn ).get() : $items.get();

					hasQueryResultNode.update( rtn.length > 0 );

					//run sort
					if (sort.by) {

						rtn.sortObject( sort.by, sort.asc );
					}

					//run paging
					if (!disablePaging && pager.enabled) {
						var count = Math.ceil( rtn.length / pager.size ) || 1;
						if (count != pager.count) {
							pager.count = count;
							if (pager.index > pager.count - 1) {
								pager.index = 0;
							}
							//
							queryNode.change( "pager" );
						}
						rtn = rtn.slice( pager.index * pager.size, (pager.index + 1) * pager.size );
					}

					return rtn;
				},

				// refreshQuery can be called via queryable.refreshQuery()
				//or it can be called via node like items*refreshQuery
				//
				// refreshQuery can be called regardless whether autoQuery is enabled,
				// because internally it check the flag to determine if
				// it is necessary to trigger the change event
				refreshQuery: function() {
					//if autoQuery is true, then don't need to trigger change again
					if (!queryable.autoQuery) {
						setTimeout( function() {
							queryResultNode.trigger( "afterUpdate" );
						}, 0 );
					}
				},

				paging: function( e ) {

					var index = e.eventData;

					if (rDigit.test( index )) {

						index = +index;

					} else {

						if (index == "next") {

							index = pager.index + 1;

						} else if (index == "previous") {

							index = pager.index - 1;

						} else if (index == "first") {

							index = 0;

						} else if (index == "last") {

							index = pager.count - 1;

						} else if (index == "disabled") {
							index = 0;
							queryable.resetPaging();
						}
					}

					if (typeof index !== "number" || index < 0 || index > pager.count - 1) {
						index = 0;
					}

					pagerNode.update( "index", index );
					queryable.refreshQuery();
				},

				resetSort: function( triggerByMasterReset ) {
					sortNode.set( "by", null )
						.set( "asc", null );

					if (triggerByMasterReset !== true) {
						queryable.refreshQuery();
					}
				},

				resetSearch: function( triggerByMasterReset ) {
					filterNode.update( "by", "" )
						.update( "value", "" )
						.update( "ops", "" );

					if (triggerByMasterReset !== true) {
						queryable.refreshQuery();
					}

				},

				resetPaging: function( triggerByMasterReset ) {
					pagerNode.update( "enabled", false )
						.update( "size", 0 )
						.update( "count", 1 )
						.update( "index", 0 );

					if (triggerByMasterReset !== true) {
						queryable.refreshQuery();
					}

				},

				resetQuery: function() {
					queryable.resetSort( true );
					queryable.resetSearch( true );
					queryable.resetPaging( true );
					queryable.refreshQuery();
				}
			}
		);

		function buildFilterFn( e ) {
			var ops = filter.ops,
				by = filter.by,
				value = filter.value,
				regex;

			if (value) {

				if (!ops) {
					//by default it s contains
					regex = RegExp( value, "i" );

				} else if (ops == "equals") {

					regex = RegExp( "^" + value + "$", "i" );

				} else {

					throw "operator does not supported";
				}

				filterFn = (by) ?
					function() {
						return regex.test( this[by] );
					} :
					function() {
						if (isObject( this )) {
							for (var key in this) {
								if (regex.test( this[key] )) {
									return true;
								}
							}
							return false;
						} else {
							return regex.test( this );
						}
					};

				filterEnabledNode.set( true );
				queryable.refreshQuery();
			} else {
				if (filterFn) {
					filterFn = null;
					filterEnabledNode.set( false );
					queryable.refreshQuery();
				}
			}
		}

		filterNode.cd( "by" ).handle( "afterUpdate", buildFilterFn );
		filterNode.cd( "value" ).handle( "afterUpdate", buildFilterFn );
		filterNode.cd( "ops" ).handle( "afterUpdate", buildFilterFn );
		return this;
	};

	bindings( {

		//listView:arrayPath|rowTemplateId
		//
		listView: //

		//subscription from view
			"tmplOnChange:.;" +
				//render newly appended data item by appending it to end of the view
			"!afterCreate.1:.|*addRowView;" +
				//render the updated data item in the view
			"!afterUpdate.1:.|*updateRowView;" +
				//delete the deleted data item in the view
			"!afterDel.1:.|*removeRowView",

		enableQuery: function( elem, path, context, options ) {
			hm( path ).enableQuery( !!options );
		},

		//render the whole list of items
		//queryView:items
		queryView: "tmplOnAnyChange:*queryResult",

		//sort:items|firstName
		sortQuery: "$click:*query.sort.by|*setTo;" +
		                 "$click:*query.sort.asc|*toggle;" +
		                 "$click:*refreshQuery",

		//resetSort:items
		resetSort: "$click:*resetSort;" +
		                 "show:*query.sort.by",

		//search:items
		search: "$click:*refreshQuery;" +
		              "enable:*query.filter.enabled",

		resetSearch: "$click:*resetSearch;" +
		                   "show:*query.filter.enabled",

		resetQuery: "$click:*resetQuery;" +
		                  "show:*query.enabled",

		searchBox: "ns:*query.filter.value;" +
		           "val:.|enter;" +
		           "$esc:.|*null",

		//pager:items|#pagerTemplate
		pager: "tmplOnAnyChange:*query.pager;" + //render pager using the data under items*query.pager
		       "show:*hasQueryResult|_;" +
		       "$paging:*paging;" +
		       "preventDefault:.",

		setPage: "true:*query.pager.enabled;" +
		               "enable:*query.pager.size;" +
		               "$click:*refreshQuery",

		//path is ignore, does not create any subscription
		page: function( elem, path, binding, pageIndex ) {
			if (!pageIndex) {
				throw "pageIndex is missing";
			}
			$( elem ).mapEvent( "click", "paging", pageIndex );
		},

		showFound: "show:*hasQueryResult",

		hideFound: "hide:*hasQueryResult"
	} );



//
/*
 <@depends>
 subscription.js,
 model.js
 </@depends>
 */


	//create a table with some seeds
	function createTable( seeds ) {
		if (isUndefined( seeds )) {
			seeds = [];
		} else if (!isArray( seeds )) {
			seeds = [seeds];
		}

		if (seeds.table && seeds.guid) {
			return seeds;
		}

		seeds.table = {};
		seeds.guid = 0;
		return seeds;
	}

	function handleArrayNodeUpdateDescendant( e ) {

		var table,
			publisher = e.publisher;

		if (e.level === 1) {
			table = publisher.get().table;

			//the event is caused by updating to the an item if the array
			for (var key in table) {
				if (table[key] == e.removed) {
					this.set( key, e.proposed );
					break;
				}
			}

		} else if (e.level >= 2) {

			var originalPath = e.originalPublisher.path,
				path = publisher.path,
				remaining = originalPath.substr( path.length + 1 ),
				index = remaining.substr( 0, remaining.indexOf( "." ) );

			if ($.isNumeric( index )) {


				//e.g contacts.1.firstName is updated
				//index == 1
				//itemKey = c1

				var itemKey = publisher.keyAt( index ),
					fullPathOfKeyItem = "table." + itemKey + remaining.substr( remaining.indexOf( "." ) );

				//subPath == table.c1.firstName
				publisher.trigger( fullPathOfKeyItem, "afterUpdate", e.proposed, e.removed );
			}
		}
	}

	function handleArrayNodeCreateChild( e ) {
		this.set( e.publisher.get().guid++, e.proposed );
	}

	function handleArrayNodeDeleteChild( e ) {
		var table = this.get(),
			removed = e.removed;

		for (var key in table) {
			if (table[key] === removed) {
				this.del( key );
				break;
			}
		}
	}

	function handleTableNodeDeleteChild( e ) {
		this.removeItem( e.removed );
	}

	function handleTableNodeUpdateChild( e ) {
		this.replaceItem( e.removed, e.proposed );
	}

	//			onAddOrUpdateHandlers[i]( contextPath, indexPath, modelValue );
	hm.onAddOrUpdateNode( function( context, index, array ) {

		if (!isArray( array )) {
			return;
		}

		var table = createTable( array ).table;

		for (var i = 0; i < array.length; i++) {
			table[array.guid++] = array[i];
		}

		var arrayNode = hm( context ).cd( index ),
			tableNode = arrayNode.cd( "table" );

		//when item is inserted in array, insert the item in table
		tableNode.sub( arrayNode, "afterCreate.1", handleArrayNodeCreateChild );

		//when item is updated in itemsNode, update the item in table
		tableNode.sub( arrayNode, "afterUpdate.*", handleArrayNodeUpdateDescendant );

		//when item deleted in array, delete the item in hash table
		tableNode.sub( arrayNode, "afterDel.1", handleArrayNodeDeleteChild );

		//when item is deleted in table, delete the item in array
		arrayNode.sub( tableNode, "afterDel.1", handleTableNodeDeleteChild );

		//when item is updated in table, update the item in array
		arrayNode.sub( tableNode, "afterUpdate.1", handleTableNodeUpdateChild );

	} );

	hmFn.itemKey = function( item ) {
		var key,
			table,
			array = this.raw();

		if (isFunction( array )) {
			array = this.main().get();
		}
		table = array.table;

		if (table) {
			for (key in table) {
				if (item === table[key]) {
					return key;
				}
			}
		}
	};

	hmFn.keyAt = function( index ) {
		return this.itemKey( this.get( index ) );
	};


//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>


	//augment jQuery Event type
	//when you attach a workflow to parent element to handle the event from children
	//we want to know the children element's row index of all the rows
	$.Event.prototype.selectedRowIndex = function() {
		return this.publisher.children().filter( this.originalPublisher.parents() ).index();
	};

	function EditObject( index ) {
		this.selectedIndex = index;
	}

	EditObject.prototype = {
		item: null,
		//logically mode depends on "item" and "index"
		//but here we disable these dependencies, because we want to
		//manually trigger the events
		//if it really depends them, the events will be hard to controlled
		mode: function __() {
			var edit = this.get(),
				item = edit.item,
				selectedIndex = edit.selectedIndex;

			return item === null ? "read" :
				isUndefined( selectedIndex ) ? "update" :
					(selectedIndex == -1) ? "new" :
						"update";

		}
	};

	//the follow methods are designed to be used with array model
	// they are used to manipulate the shadow edit object of array model
	extend( hmFn, {

		//initShadowEdit is required for array model or for array query functions
		//it is not necessary for model of other type
		initShadowEdit: function( itemTemplate ) {
			//it is a convention that, if the path of list data is items
			//we take items_itemTemplate as template from new item for the list data

			var model = this;

			if (model.get( "*edit" )) {
				return;
			}
			var itemsPath = model.path,
				rChildShadowItem = RegExp( "^" + itemsPath.replace( ".", "\\." ) + "\\*edit\\.item[^*]+\\*$" ),
				rDeepShadowItem = RegExp( "^" + itemsPath.replace( ".", "\\." ) + "\\*edit\\.item[\\w.]+\\*edit\\.item" );

			if (isUndefined( itemTemplate )) {

				if (model.isShadow() && !isFunction( model.raw() )) {
					//if the array object items is already in shadow
					//the itemTemplate is already defined in main items' itemTemplate
					//for example
					//the itemsPath is "doc.entries*edit.item.personal.signatures"
					//the itemTemplate is defined in "doc.entries*edit.item.personal.signatures.0"
					//the following is try to get the itemTemplate
					//
					//the mainModel is doc.entries
					var mainModel = model.main();

					//the editingModelPath of mainModel is doc.entries*edit.item
					var editingModelPath = mainModel.logicalPath() + "*edit.item";

					//the position of last "." in "doc.entries*edit.item."
					var startIndex = editingModelPath.length + 1;

					//the portion of "personal.signatures" in "doc.entries*edit.item.personal.signatures"
					var subPath = toLogicalPath( itemsPath ).substr( startIndex );

					//get "doc.entries*edit.itemTemplate.personal.signatures.0"
					itemTemplate = clone( mainModel.get( "*edit.itemTemplate." + subPath + ".0" ), true );

				} else {

					//the convention is that if we have model at path "contacts",
					//the template item is expected at "contacts_itemTemplate"
					if (isFunction( model.raw() )) {
						itemTemplate = rootNode.raw( model.main().path + "_itemTemplate" );
					} else {
						itemTemplate = rootNode.raw( itemsPath + "_itemTemplate" );
					}

					//if convention is not followed, use the existing as template
					if (isUndefined( itemTemplate )) {
						itemTemplate = clearObj( clone( model.get()[0], true ) );
					}
				}
			}

			var editObject = new EditObject( -1 );
			editObject.itemTemplate = itemTemplate;
			editObject.item = null;

			model.set( "*edit", editObject );

			//we want to trigger beginInRowUpdate/cancelInRowUpdate after selectedIndex has changed
			//because the handlers depends on the availability of selectedIndex
			model.cd( "*edit.selectedIndex" ).handle( "afterUpdate", function( e ) {

				var newIndex = e.proposed,
					oldIndex = e.removed;

				if (newIndex >= 0) {

					model.trigger( "beginInRowUpdate", newIndex );

				} else if (newIndex == -1) {

					model.trigger( "cancelInRowUpdate", oldIndex );
				}
			} );

			model.cd( "*edit.item" ).handle( "afterUpdate", function( e ) {
				var key, logicalPath, editObject;

				for (key in shadowRoot) {

					logicalPath = util.toLogicalPath( "__hm." + key );

					if (rDeepShadowItem.test( logicalPath )) {

						delete shadowRoot[key];

					} else if (rChildShadowItem.test( logicalPath )) {

						editObject = shadowRoot[key].edit;

						if (editObject) {
							editObject.item = null;
							editObject.selectedIndex = -1;
						}
					}
				}
			} );
			return this;
		},

		//create a new item in shadow edit object for items model
		//not necessary for model of primitive type and objects
		newShadowItem: function() {
			if (this.get( "*edit.mode" ) !== "read") {
				this.resetShadowItem();
			}

			var editShadowModel = this.cd( "*edit" ),
				itemTemplate = editShadowModel.raw( "itemTemplate" ),
				item = (isFunction( itemTemplate )) ?
					itemTemplate() :
					clone( itemTemplate, true );

			editShadowModel.update( "item", item );
			editShadowModel.change( "mode" );
		},

		editShadowItem: function( item, itemIndex ) {

			var itemValue = this.raw();
			if (isPrimitive( itemValue ) || isObject( itemValue )) {

				var edit = this.get( "*edit" );
				if (isUndefined( edit )) {
					edit = new EditObject();
					this.set( "*edit", edit );
				}

				if (edit.item !== null) {
					return;
				}

				this.set( "*edit.item", clone( itemValue, true ) );
				this.change( "*edit.mode" );

			} else {

				if (this.get( "*edit.mode" ) !== "read") {
					this.resetShadowItem();
				}

				if (isUndefined( itemIndex )) {
					itemIndex = this.indexOf( item );
				} else {
					item = this.get()[itemIndex];
				}

				var editShadowModel = this.cd( "*edit" ),
					itemTemplate = editShadowModel.raw( "itemTemplate" ),
					copy = (isFunction( itemTemplate )) ?
						itemTemplate( item ) :
						clone( item, true );

				editShadowModel.update( "item", copy )
					.update( "selectedIndex", itemIndex );

				editShadowModel.change( "mode" );
			}

		},

		resetShadowItem: function( save ) {
			if (this.path.endsWith( ".edit.item" )) {
				return this.main().resetShadowItem();
			}

			var items = this.raw();
			if (isPrimitive( items ) || isObject( items )) {

				this.set( "*edit.item", null );
				this.change( "*edit.mode" );

			} else {

				var edit = this.cd( "*edit" );
				if (!isUndefined( edit.get() )) {

					edit.update( "item", null );

					if (save) {
						//if it triggered by saveShadowItem
						//update selectedIndex directly to avoid events
						edit.get().selectedIndex = -1;
					} else {
						edit.update( "selectedIndex", -1 );
					}

					edit.change( "mode" );
				}
			}

		},

		saveShadowItem: function() {

			if (this.path.endsWith( ".edit.item" )) {
				return this.main().saveShadowItem();
			}

			var items = this.raw();

			if (isPrimitive( items ) || isObject( items )) {

				this.set( this.get( "*edit.item" ) )
					.set( "*edit.item", null );

				this.change( "*edit.mode" );

			} else {

				var currentEditMode = this.get( "*edit.mode" ),
					pendingItem = this.get( "*edit.item" );

				if (currentEditMode == "read") {

					throw "invalid operations";

				} else if (currentEditMode == "new") {

					if (isFunction( items )) {
						//this is case when items is model*queryResult
						this.main().push( pendingItem );

					} else {
						this.push( pendingItem );
					}

					this.resetShadowItem();

				} else /*if (currentEditMode == "update")*/ {

					var selectedIndex = this.get( "*edit.selectedIndex" );

					if (isFunction( items )) {
						//this is case when items is model*queryResult
						items = this.get();
						this.main().replaceItem(
							items[selectedIndex],
							pendingItem
						);
					} else {
						this.replaceItem(
							items[selectedIndex],
							pendingItem
						);
					}
					this.resetShadowItem( true );
				}

			}
		}
	} );

	hm.workflow( {

		//------workflows that modify model------

		//$click:items|*editShadowItem
		//$click:items*queryResult|*editShadowItem
		newShadowItem: "*fakeGet newShadowItem",

		//$click:item|*editShadowItem
		//$editRow:items|*editShadowItem
		//$editRow:items*queryResult|*editShadowItem
		editShadowItem: function( e ) {
			if (e.type == "editRow") {
				//this trigger by edit button
				this.editShadowItem( null, e.selectedRowIndex() );
			} else {
				if (this.path.endsWith( ".edit.item" )) {
					this.main().editShadowItem( this.get() );
				} else {
					this.editShadowItem();
				}
			}
			e.stopPropagation();
		},

		//"$delete:items|*removeItem;"
		//"$delete:items*queryResult|*removeItem;"
		removeItem: function( e ) {
			if (this.get( "*edit.mode" ) != "read") {
				this.resetShadowItem();
			}
			var index = e.selectedRowIndex();
			var items = this.raw();
			if (isFunction( items )) {
				//this is case when items is model*queryResult
				items = this.get();
				this.main().removeItem( items[index] );
			} else {
				this.removeAt( index );
			}
			e.stopPropagation();
		},

		//$moveUp:items|*moveUpItem;
		moveUpItem: function( e ) {
			var selectedIndex = e.selectedRowIndex();
			this.move( selectedIndex, selectedIndex - 1 );
			e.stopPropagation();
		},

		//$moveUp:items|*moveUpItem;
		moveDownItem: function( e ) {
			var selectedIndex = e.selectedRowIndex();
			this.move( selectedIndex, selectedIndex + 1 );
			e.stopPropagation();
		},

		//------workflows that modify views------

		//!afterUpdate:items*edit.mode|*renderNewView;
		//!afterUpdate:items*queryResult*edit.mode|*renderNewView;
		renderNewView: newTemplateHandler(
			function( e ) {
				if (e.publisher.get() == "new") {
					return e.publisher.main().get( "*edit.item" );
				}
			}
			/*set activity is by default html*/

		),

		//"!beginInRowUpdate:items|*renderUpdateRowView;"
		//"!beginInRowUpdate:items*queryResult|*renderUpdateRowView;"
		renderUpdateRowView: newTemplateHandler(
			//get activity
			function( e ) {
				return e.publisher.get( "*edit.item" );
			},
			//set activity
			function( value, e ) {
				//e.proposed is the index of the edit item
				this.children().eq( e.proposed ).replaceWith( value );
			} ),

		//"!beginInRowUpdate:items|*renderUpdateRowView;"
		//"!beginInRowUpdate:items*queryResult|*renderUpdateRowView;"
		destroyUpdateRowView: function( e ) {
			e.publisher.change( e.proposed );
		},

		//$click:items*edit.item|*saveShadowItem;
		//$click:items*queryResult*edit.item|*saveShadowItem;
		saveShadowItem: function( e ) {
			this.saveShadowItem();
			e.stopPropagation();
		},

		//$click:items*edit.item|*resetShadowItem;
		//$click:items*queryResult*edit.item|*resetShadowItem;
		resetShadowItem: function( e ) {
			this.resetShadowItem();
			e.stopPropagation();
		}
	} );

	bindings( {


		// shadowEdit:items|rowTemplateId or
		// shadowEdit:items*queryResult|rowTemplateId
		shadowEdit: "!init:.|initShadowEdit *fakeSet;" +
		            "deleteRow:.;" +
		            "$editRow:.|*editShadowItem",

		// shadowEditInRow:items|updateRowTemplateId or
		// shadowEditInRow:items*queryResult|updateRowTemplateId
		shadowEditInRow: "shadowEdit:.;" +
		                 "!beginInRowUpdate:.|*renderUpdateRowView;" +
		                 "!cancelInRowUpdate:.|*destroyUpdateRowView",

		deleteRow: "$deleteRow:.|*confirm|_Do you want to delete this item?;" +
		           "$deleteRow:.|*removeItem;",
		//movableRow:items
		movableRow: "$moveUp:.|*moveUpItem;" +
		            "$moveDown:.|*moveDownItem;",

		//newItemView:items
		//newItemView:items*queryResult
		newItemView: "!afterUpdate:*edit.mode|*renderNewView;" +
		             "showOnNew:.",

		//showOnNew:items
		//showOnNew:items*queryResult
		showOnNew: "show:*edit.mode|_new",

		//hideOnNew:items
		//hideOnNew:items*queryResult
		hideOnNew: "hide:*edit.mode|_new",

		//editItemView:items
		//editItemView:items*queryResult
		editItemView: "tmplOnChange:*edit.item;" +
		              "showOnEdit:.",

		displayItemView: "tmplOnChange:.;hideOnEdit:.",

		//showOnEdit:items
		//showOnEdit:items*queryResult
		//showOnEdit: "hide:*edit.mode|_read",
		showOnEdit: function( elem, path, context, options ) {
			context.appendSub( elem, path + "*edit.mode", "init afterUpdate", function( e ) {
				var mode = e.publisher.get();
				this[(isUndefined( mode ) || mode == "read") ? "hide" : "show"]();
			} );
		},

		//hideOnEdit:items
		//hideOnEdit:items*queryResult
		//hideOnEdit: "show:*edit.mode|_read",
		hideOnEdit: function( elem, path, context, options ) {
			context.appendSub( elem, path + "*edit.mode", "init afterUpdate", function( e ) {
				var mode = e.publisher.get();
				this[(isUndefined( mode ) || mode == "read") ? "show" : "hide"]();
			} );
		},

		//newItem:items
		//newItem:items*queryResult
		newItem: "$click:.|*newShadowItem;" +
		         "hideOnNew:.",

		//editButton:item
		//this is only used non-array item edit
		editObject: "$click:.|*editShadowItem;hideOnEdit:.",

		//saveEdit:items*edit.item
		//saveEdit:items*queryResult*edit.item
		saveEdit: "$click:.|*saveShadowItem",

		//cancelEdit:items*edit.item
		//cancelEdit:items*queryResult*edit.item
		cancelEdit: "$click:.|*resetShadowItem"

	} );

	hm.newJqEvent( {

		editRow: ["click", function( e ) {
			return $( e.target ).hasClass( "editRow" );
		}],

		deleteRow: ["click", function( e ) {
			return $( e.target ).hasClass( "deleteRow" );

		}],

		moveUp: ["click", function( e ) {
			return $( e.target ).hasClass( "moveUp" );
		}],

		moveDown: ["click", function( e ) {
			return $( e.target ).hasClass( "moveDown" );
		}]
	} );

//


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

//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//



	defaultOptions.selectedClass = "selected";
	defaultOptions.tabViewAttr = "tab-view";
	defaultOptions.tabLinkAttr = "tab-link";
	defaultOptions.tabContainerNameAttr = "tab-container-name";

	hm.workflow( {

		//a tab can be tabView or tabLink
		selectTab: function( e ) {
			var tabId = this.attr( defaultOptions.tabViewAttr ) || this.attr( defaultOptions.tabLinkAttr ),
				selectedClass = e.handler.options;

			if (e.publisher.get() == tabId) {
				this.addClass( selectedClass );
			} else {
				this.removeClass( selectedClass );
			}
		},

		//a tab can be tabView or tabLink
		selectTabInContainer: function( e ) {
			var selectedTabId = e.publisher.get(),
				tabViewAttr = defaultOptions.tabViewAttr,
				tabLinkAttr = defaultOptions.tabLinkAttr,
				options = e.handler.options,
				tabLinkAndTabViewSelector = options.selector,
				selectedClass = options.selectedClass;

			this.find( tabLinkAndTabViewSelector ).andSelf().each( function( index, elem ) {
				var $elem = $( elem ),
					tabId = $elem.attr( tabViewAttr ) || $elem.attr( tabLinkAttr );

				if (tabId == selectedTabId) {
					$elem.addClass( selectedClass );
				} else {
					$elem.removeClass( selectedClass );
				}
			} );
		}
	} );

	function handleTabLinkClick( e ) {
		//this is the subscriber, which is the model
		//e.handler.options is the tab id
		this.set( e.publisher.attr( e.handler.options ) );
		e.preventDefault();
		e.stopPropagation();

	}

	//a tab can be tabView or tabLink
	//for tabLink use <li tab-link="news" tab="category">News</li>
	//if your selected class is not "selected" but "active" use
	// <li tab-link="news" tab="category|active">News</li>
	//
	//for tabView use <div tab-view="news" tab="category">contents</div>
	//or <div tab-view="news" tab="category|active">contents</div>
	bindings( {

		tab: function( elem, path, binding, selectedClass ) {

			selectedClass = selectedClass || defaultOptions.selectedClass;

			binding.appendSub( elem, path, "init afterUpdate", "*selectTab", selectedClass );

			if ($( elem ).attr( defaultOptions.tabLinkAttr )) {
				binding.appendSub( path, elem, "click", handleTabLinkClick, defaultOptions.tabLinkAttr );
			}

		},

		//a tabContainer can hold tabLink or tabView
		//it can be
		//
		//<ul tab-container="category">
		//	<li tab-link="news">News</li>
		//	<li tab-link="opinion">Opinion</li>
		//	<li tab-link="sports">Sports</li>
		//</ul>
		//
		//<div class="tabs" tab-container="category">
		//	<div tab-view="news">content</div>
		//	<div tab-view="opinion">content</div>
		//</div>
		//options usage
		//tab-container="category|containerName,selectedClass"
		//if you have tab container nested within another tab container
		//you can use container name to specify which container it is in
		tabContainer: function( elem, path, context, options ) {

			options = options || "";
			options = options.split( "," );

			var tabViewAttr = defaultOptions.tabViewAttr,
				tabLinkAttr = defaultOptions.tabLinkAttr,
				tabContainerNameAttr = defaultOptions.tabContainerNameAttr,
				containerName = options[0],
				selectedClass = options[1],

				tabContainerSelector = containerName ?
					"[" + tabContainerNameAttr + "='" + containerName + "']" //with explicit tab container name
					: "", //no tab container name

				tabLinkSelector = "[" + tabLinkAttr + "]" + tabContainerSelector,

				tabLinkAndTabViewSelector = tabLinkSelector + ",[" + tabViewAttr + "]" + tabContainerSelector;

			//update the tab model with the tabLink when click
			context.appendSub( path, elem, "click", handleTabLinkClick, tabLinkAttr, tabLinkSelector /*delegateSelector*/ );

			//
			//highlight the tab when the model change
			context.appendSub( elem, path, "init100 afterUpdate", "*selectTabInContainer", {
				selector: tabLinkAndTabViewSelector,
				selectedClass: selectedClass || defaultOptions.selectedClass
			} );
		}
	} );

//data-sub="@app:appName,options"


	var rDot = /\./g,
		appStore = {},
	//used to match "appName,options"
		rAppOptions = /^([^,]+)(,(.+))?$/,
		rLoadAppOptions = /^([^,]+)(,([^,]+))?(,(.+))?$/;

	//you app should implement load(elem, options) and unload(elem) method

	hm.App = hm.Class.extend(

		//instance members
		{
			//exists simply for ensure app must have a name
			initialize: function( app ) {

				if (!app.name) {
					throw "An app must have a name.";
				}
				this.callBase( "initialize", app );

			},

			//it add additional logic beside the original load method
			//such as instance counting, instance association with the container
			//prepare to unload from the container
			load: function( $viewContainer, hmModelContainer, options ) {
				if (!$viewContainer || !this.loadable()) {
					return;
				}
				var app = this,
					buildModelResult,
					appName = app.name,
					appInstance = instanceManager.get( $viewContainer[0], appName );

				//ensure that an application can be loaded into a container only once
				if (appInstance) {
					return;
				}

				if (app.loadModel) {
					buildModelResult = app.loadModel( hmModelContainer, options );

				}

				var continuation = function() {

					app.loadView( $viewContainer, hmModelContainer );
					instanceManager.add( $viewContainer[0], hmModelContainer.path, appName, app );
					$viewContainer.bind( "exitApp." + appName, function( e ) {
						app.unload( $( this ) );
						e.stopPropagation();
					} );

					app.instanceCount++;
					app.uid++;
				};

				if (isPromise( buildModelResult )) {

					buildModelResult.done( continuation );

				} else {
					continuation();

				}

			},

			unload: function( $viewContainer ) {

				var appName = this.name;
				var appInstance = instanceManager.get( $viewContainer[0], appName );

				this.unloadView( $viewContainer );

				this.unloadModel( appInstance.modelNode );

				instanceManager.remove( $viewContainer[0], appName );

				$viewContainer.unbind( "exitApp." + appName );

				this.instanceCount--;
			},

			//function( modelContainer, options ) {}
			getInitialData: null,

			//default implementation of loadModel is to call
			//app.getInitialData() and put the result into model
			//
			//You can set loadModel to null to specify that
			// there is no need to build model
			loadModel: function( hmModelContainer, options ) {
				var app = this;
				if (!app.getInitialData) {
					throw "app.getInitialData is not implemented";
				}

				var data = app.getInitialData( hmModelContainer, options );

				if (isPromise( data )) {
					return data.done( function( data ) {
						app.getModelNode( hmModelContainer ).set( data );
					} );
				} else {
					app.getModelNode( hmModelContainer ).set( data );
				}

			},

			unloadModel: function( modelNamespace ) {
				if (this.loadModel) {
					hm.del( modelNamespace );
				}
			},

			//the default loadView will create a container
			//<div appname="xxx" ns="xxx"></div>
			loadView: function( $viewContainer, hmModelContainer ) {

				var namespace = this.getModelNode( hmModelContainer ).path,
					viewWrapper = $( "<div></div>" )
						.attr( "appname", this.name )
						.attr( "ns", namespace );

				viewWrapper.hmData( "ns", namespace );

				viewWrapper.appendTo( $viewContainer ).tmpl(
					this.getTemplateOptions(),
					namespace );

			},

			unloadView: function( $viewContainer ) {
				$viewContainer.find( "> [appname='" + this.name + "']" ).remove();
			},

			//templateOptions is about template id
			//by default you can get templateOptions property or
			//the application name as templateOptions
			getTemplateOptions: function() {
				return this.templateOptions || this.name;

			},

			getModelNode: function( hmModelContainer ) {
				var subPath = this.subPath || this.name.replace( rDot, "_" );
				//if we have more than one instance, the subPath need to be
				//be suffix with an uid to make this namespace unique
				if (this.uid) {
					subPath = subPath + this.uid;
				}
				return hmModelContainer.cd( subPath );

			},

			instanceCount: 0,

			uid: 0,

			//if we want to use singleton use the following
			//		loadable: function() {
			//			return !this.instanceCount;
			//		},
			loadable: returnTrue,

			templateOptions: null,

			//path that wrap this model,
			//but this should not be used by consumer
			subPath: null


		},

		//static members
		{

			//hm.App.add({
			//  name: "gmail", //you must have a name
			//  load: function (viewContainer, modelContainer, options) {},
			//  unapp: function (viewContainer, modelContainer) {}, //optional
			//  //optional, by default it is not loadable if it has been loaded once
			//  //if it is loadable: true , it means it is always loadable
			//  loadable: function () {},
			// });
			add: function( app ) {
				if (!(app instanceof this)) {
					app = this( app );
				}
				appStore[app.name] = app;
			},

			remove: function( appName ) {
				if (appStore[appName] && !appStore[appName].instanceCount) {
					delete appStore[appName];
				}
			},

			get: function( appName ) {
				return appStore[appName];
			},

			//fetch the definition of the application
			loadDefinition: function( appName ) {
				return _loader.load( appName + ".app" );
			},

			//support the following feature
			//by default container is body, if container is missing
			//hm.App.loadApp(appName);
			//
			//hm.App.loadApp(appName, viewContainer); //viewContainer is jQuery
			//hm.App.loadApp(appName, modelContainer); //modelContainer is string
			//
			//container is jQuery object, or DOM element
			//appName is string,
			//options is optional
			loadApp: function( appName, $viewContainer, hmModelContainer, options ) {

				if (arguments.length == 1) {

					$viewContainer = $( document.body );
					hmModelContainer = rootNode;

				} else if (arguments.length == 2) {

					hmModelContainer = rootNode;

				}

				var app = appStore[appName];

				if (app) {

					app.load( $viewContainer, hmModelContainer, options );

				} else {

					this.loadDefinition( appName ).done( function() {
						appStore[appName].load( $viewContainer, hmModelContainer, options );
					} );
				}
			},

			//container by default is document.body
			//hm.App.unloadApp(appName)
			//hm.App.unloadApp(container, appName);
			unloadApp: function( appName, $viewContainer ) {
				if (isUndefined( appName )) {
					appName = $viewContainer;
					$viewContainer = $( "body" );
				}

				var appInstance = instanceManager.get( $viewContainer, appName );
				if (appInstance) {
					appInstance.app.unload( $viewContainer );
				}
			}

		} );

	var instanceManager = {

		get: function( viewContainerElem, appName ) {
			return this.appData( viewContainerElem )[appName];
		},

		add: function( viewContainerElem, modelContainerPath, appName, app ) {
			this.appData( viewContainerElem )[appName] = {
				app: app,
				modelNode: app.getModelNode( hm( modelContainerPath ) ),
				modelContainer: modelContainerPath
			};
		},

		remove: function( viewContainerElem, appName ) {
			delete this.appData( viewContainerElem )[appName];
		},

		appData: function( viewContainerElem, readOnly ) {
			var appData = $( viewContainerElem ).hmData( "app" );
			if (!readOnly && !appData) {
				appData = { };
				$( viewContainerElem ).hmData( "app", appData );
			}
			return appData;
		}
	};

	bindings( {
		//app="/|gmail,options"
		//data-sub="app:/|gmail,options"
		app: function( elem, path, context, options ) {

			var match = rAppOptions.exec( $.trim( options ) ),
				appName = match[1],
				appOptions = match[3];

			hm.App.loadApp( appName, $( elem ), hm( path ), appOptions );
		},

		//exit-app="_|gmail"
		//unload app from parent container
		//data-sub="exitApp:_|gmail"
		exitApp: function( elem, parseContext, binding, options ) {
			$( elem ).mapEvent( "click", "exitApp." + options );
		},

		//load an app when click
		//load-app="/|gmail,#containerId,options"
		//data-sub="loadApp:/|gmail,#containerId,options"
		loadApp: function( elem, path, context, options ) {

			var optionParts = rLoadAppOptions.exec( $.trim( options ) ),
				appName = optionParts[1],
				$viewContainer = $( optionParts[3] ),
				otherOptions = optionParts[5];

			$( elem ).click( function() {
				hm.App.loadApp( appName, $viewContainer, hm( path ), otherOptions );
			} );
		},

		//unloadApp
		//unload an app when click
		//unload-app=":_|gmail,#container"
		//data-sub="unloadApp:_|gmail,#container"
		unloadApp: function( elem, path, context, options ) {

			var optionParts = rLoadAppOptions.exec( $.trim( options ) ),
				appName = optionParts[1],
				$viewContainer = $( optionParts[3] );

			$( elem ).click( function() {
				hm.App.unloadApp( appName, $viewContainer );
			} );
		}
	} );

	var _cleanDataForApp = $.cleanData;

	$.cleanData = function( elems ) {
		$( elems ).each( function() {
			var appData = instanceManager.appData( this, true );
			if (appData) {
				for (var key in appData) {
					var app = appData[key];
					delete appData[key];
					app.unload( this, true );
				}
			}
		} );
		_cleanDataForApp( elems );
	};

	_loader( "app", "js", {
		url: function( moduleId ) {
			//if module id is like *hello, then it is widget
			var fileName = _loader.fileName( moduleId );
			return fileName.startsWith( "apk." ) ?
				//if app is package is apk, then load it
				//in apk folder
				"apk/" + fileName.substr( 4 ) + "/main.js" :

				//otherwise load in app folder
				"app/" + fileName + ".js";
		}
	} );



})( jQuery, window );

