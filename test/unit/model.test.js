module( "model.js" );
//__hm
var shadowNamespace = hm.debug.shadowNamespace;
var rootNode = hm();
hm.options.autoParse = false;
var debug = hm.debug;

function testArea () {
	return $( "#qunit-fixture" );
}

function assertEmptyDb () {
	debug.removeAll();
	var root = hm.get();
	var rootCopy = $.extend( {}, root );
	delete rootCopy.__hm;

	var isEmpty = $.isEmptyObject( rootCopy )
		&& $.isEmptyObject( hm.util._referenceTable );

	if (hm.subscriptions) {
		isEmpty = isEmpty && (hm.subscriptions.length === 0);
	}
	ok( isEmpty, "The root is empty" );
}

test( "array prototype extension", function() {

	var items = [1, 2];
	equal( 0, items.indexOf( 1 ), "indexOf array always works" );
	ok( items.contains( 1 ), "array 'contains' method returns true when array contain element" );

	items.remove( 1 );

	ok( !items.contains( 1 ), "array 'contains' method return false when array does not contain element" );

	equal( -1, items.indexOf( 1 ), "array.remove(item1) can remove item1, and item1 is in array" );

	items.pushUnique( 2 );
	equal( 1, items.length, "array.pushUnique will not push an item, if an item is already in the list" );

	var objects = [
		{name: "b"},
		{name: "a"},
		{name: "c"}
	];

	objects.sortObject( "name" );

	equal( $.map( objects,
		function( elem, index ) {
			return elem.name;
		} ).join( "" ), "abc", "array.sortObject(propertyName) can sort array in asc order" );

	objects.sortObject( "name", false );

	equal( $.map( objects,
		function( elem, index ) {
			return elem.name;
		} ).join( "" ), "cba", "array.sortObject(propertyName, false) can sort array in desc order" );

	var testString = "abcdefg";
	ok( testString.startsWith( "abc" ), "string.startsWith(x) return true if it begins with x" );
	ok( testString.endsWith( "efg" ), "string.endsWith(x) return true if it ends with x" );
	ok( testString.contains( "bcd" ), "string.contains(x) return true if it contains x" );

} );

test( "toTypedValue", function() {

	var toTypedValue = hm.util.toTypedValue;
	ok( toTypedValue( "abc" ) === "abc", "a string can not be convert to other type will not be converted" );
	ok( toTypedValue( "1" ) === 1, "convert a number" );
	ok( toTypedValue( "true" ) === true, "convert true" );
	ok( toTypedValue( "false" ) === false, "convert false" );
	ok( toTypedValue( "" ) === "", "empty string will not be converted" );
	ok( toTypedValue( "undefined" ) === undefined, "can convert undefined" );
	deepEqual( toTypedValue( '{"name":"hello"}' ), {name: "hello"}, "can convert json object" );
	notEqual( toTypedValue( "{'name':'hello'}" ), {name: "hello"}, "single quote ' style json string" +
	                                                               " can not be converted json object" );
} );

test( "node creation test", function() {

	strictEqual( "", rootNode.path,
		"hm() return a root node, and its context is empty string" );

	var rootShadowNode = hm( "*" );

	strictEqual( rootShadowNode.path, shadowNamespace,
		"hm(\"*\") return rootShadowNode, and its context is hm namespace" );

	var rootShadowModel2 = rootNode.cd( "*" );

	equal( rootShadowModel2.path, shadowNamespace,
		"rootNode.cd(\"*\") return rootShadowModel2, and its context is hm namespace" );

	ok( rootNode === rootShadowModel2.previous,
		"node.previous can return the previous node" );

	equal( rootNode.shadow().path, rootShadowNode.path,
		"node.shadow() can return shadow node" );

	equal( rootShadowNode.main().path, rootNode.path,
		"node.main() can return original node" );

	ok( "" === rootNode.parent().path,
		"rootNode.parent() also return a root node" );

	var unExistsPath = hm( "unExistsPath" );

	ok( true, "hm(unExistsPath) will not throw exception" );

	var shadowOfUnExistsPath = hm( "unExistsPath*" );
	ok( true, "hm(unExistsPath*) will not throw exception" );

	strictEqual( shadowOfUnExistsPath.get(), undefined,
		"If a main model is undefined, then its shadow will not be automatic created" );

	rootNode.create( "unExistsPath", {} );

	strictEqual( shadowOfUnExistsPath.get(), undefined,
		"If a shadow model is created before main model is created," +
		"after main model is created, the shadow model" +
		"still cannot get the value of shadow model" );

	var shadowOfUnExistsPath2 = hm( "unExistsPath*" );

	ok( shadowOfUnExistsPath2.get(),
		"after a main model is created, accessing its " +
		"shadow will return a model, because shadow model will be" +
		"automatically created  when it is accessed after" +
		"its mail model has been defined" );

	rootNode.del( "unExistsPath" );

	strictEqual( rootNode.get( "unExistsPath*" ), undefined,
		"after a path of a model is deleted, then its shadow will be automatic deleted" );

	strictEqual( unExistsPath.get(), undefined,
		"After a model, model.get() will get undefined" );
} );

test( "hm.toPhysicalPath and hm.toLogicalPath", function() {
	var toPhysicalPath = hm.util.toPhysicalPath;
	var toLogicalPath = hm.util.toLogicalPath;
	equal( toPhysicalPath( '' ), "", "hm.toPhysicalPath('') == ''" );
	equal( toPhysicalPath( '*' ), "__hm", "hm.toPhysicalPath('') == '__hm'" );
	equal( toPhysicalPath( 'a.b' ), "a.b", "hm.toPhysicalPath('a.b') == 'a.b'" );
	equal( toPhysicalPath( 'a.b*' ), "__hm.a#b", "hm.toPhysicalPath('a.b*') == '__hm.a#b'" );
	equal( toPhysicalPath( 'a.b*c.d' ), "__hm.a#b.c.d", "hm.toPhysicalPath('a.b*c.d') == '__hm.a#b.c.d'" );
	equal( toPhysicalPath( '*c.d' ), "__hm.c.d", "hm.toPhysicalPath('*c.d') == '__hm.c.d'" );

	equal( toLogicalPath( '__hm' ), "*", "hm.toLogicalPath('__hm') == '*'" );
	equal( toLogicalPath( 'a.b' ), "a.b", "hm.toLogicalPath('a.b') == 'a.b'" );
	equal( toLogicalPath( '__hm.a#b' ), "a.b*", "hm.toLogicalPath('__hm.a#b') == 'a.b*'" );
	equal( toLogicalPath( '__hm.a#b.c.d' ), "a.b*c.d", "hm.toLogicalPath('__hm.a#b.c.d') == 'a.b*c.d'" );
} );

test( "extend model prototype", function() {
	var fn = hm.fn;

	ok( hm.fn, "hm.fn (prototype) is defined" );

	ok( fn.create && fn.update && fn.del && fn.get,
		"prototype has basic function like create/update/remove/get" );

	ok( !rootNode.newMember,
		"node does not have newMember" );

	fn.newMember = {};

	ok( rootNode.newMember,
		"after node prototype is added with newMember, node now has newMember" );

	delete fn.newMember;

	ok( !rootNode.newMember,
		"after delete newMember from model prototype, model does not have newMember" );

} );

test( "basic CRUD method of model", function() {

	var path = "a";
	var value = "a";
	var newValue = "b";
	var result;

	ok( rootNode.get(), "rootNode.get() return the root" );
	ok( rootNode.get()[shadowNamespace], "By default, root has private storage as root[shadowNamespace]" );

	result = rootNode.create( path, value );
	equal( result, rootNode, "rootNode.create(path, value) return the model itself" );
	equal( value, rootNode.get( path ), "rootNode.get( path ) can retrieve the value set by" +
	                                         "root.create(path, value)" );

	result = rootNode.update( path, newValue );
	equal( result, rootNode, "rootNode.update(path, value) return the model itself" );
	equal( rootNode.get( path ), newValue, "root.get( path ) can retrieve the value" +
	                                            " updated by rootNode.update(path, newValue)" );

	rootNode.del( path );
	equal( rootNode.get( path ), undefined, "rootNode.remove(path) can delete the value" +
	                                             " at path" );

	var unExistsMultiSegmentPath = "djfkjdfk.jkjdfkj";

	strictEqual( rootNode.get( unExistsMultiSegmentPath ), undefined,
		"rootNode.get(invalidPath) will return undefined" );

	raises( function() {
		rootNode.create( unExistsMultiSegmentPath, value );
	}, function( e ) {
		var reg = new RegExp( unExistsMultiSegmentPath );
		return !!reg.exec( e );
	}, "rootNode.create(unExistsMultiSegmentPath, value) will result invalid path exception" );

	raises( function() {
		rootNode.update( unExistsMultiSegmentPath, value );
	}, function( e ) {
		var reg = new RegExp( unExistsMultiSegmentPath );
		return !!reg.exec( e );
	}, "rootNode.update(invalidPath, value) will result invalid path exception" );

	raises( function() {
		rootNode.del( unExistsMultiSegmentPath );
	}, function( e ) {
		var reg = new RegExp( unExistsMultiSegmentPath );
		return !!reg.exec( e );
	}, "rootNode.remove(invalidPath) will result invalid path exception" );

} );

test( "force update", function() {

	hm.set( "customer", { first: "john", last: "doe"} );

	var handlerCalled = false;

	hm.handle( "customer", "*", function() {
		handlerCalled = true;
	} );

	hm( "customer.first" ).update( true, "ken" );
	ok( false == handlerCalled && hm( "customer.first" ).get() == "ken", "when force update there will be no model event raised" );

	hm( "customer.first" ).set( true, "tim" );

	ok( false == handlerCalled && hm( "customer.first" ).get() == "tim", "when force update there will be no model event raised" );

	hm( "customer.first" ).update( "susan" );
	strictEqual( true, handlerCalled, "when update normally, model event will be raised" );

	assertEmptyDb();

} );

test( "other CRUD method of model", function() {

	var f = "f";
	var obj = {
		a: "a",
		b: "b",
		getf: function() {
			return f;
		},
		setf: function( value ) {
			f = value;
		}
	};
	rootNode.extend( obj );

	var model = $.extend( {}, rootNode.raw() );
	delete model.__hm;
	deepEqual( model, obj, "you can create complex object like model.create(obj) as a shortcut to model.create(path, obj)" );

	var obj2 = {
		a: "a2",
		b: "b2"
	};

	rootNode.extend( obj2 );
	var model2 = $.extend( {}, hm.get() );
	delete model2.__hm;

	deepEqual( model2, $.extend( {}, obj, obj2 ), "you can create complex object like model.create(obj) as a shortcut to model.create(path, obj)" );

	rootNode.set( "a", "a2" );
	equal( rootNode.get( "a" ), "a2", "set will update if path exists" );

	rootNode.set( "c", "c" );
	equal( rootNode.get( "c" ), "c", "set will create if path not exists" );

	equal( rootNode.get( "getf" ), f, "get can call a function in model" );
	rootNode.set( "setf", "f2" );
	equal( f, "f2", "model.get can also call a function to update model" );

	rootNode.createIfUndefined( "a", "a3" );
	equal( rootNode.get( "a" ), "a2", "createIfUndefined will not create if path exists" );

	rootNode.createIfUndefined( "d", "d" );
	equal( rootNode.get( "d" ), "d", "createIfUndefined will create if path not exists" );

	assertEmptyDb();
} );

test( "test watch integrity in model remove", function() {

	var jsonObject = {
		a: "a",
		b: {
			c: "c"
		},
		d: function() {
			return this.get( "..a" );
		},
		e: function() {
			return this.get( "..d" );
		}
	};

	rootNode.extend( jsonObject );
	deepEqual( {
		a: "a",
		b: {
			c: "c"
		},
		d: "a",
		e: "a"
	}, {
		a: rootNode.get( "a" ),
		b: rootNode.get( "b" ),
		d: rootNode.get( "d" ),
		e: rootNode.get( "e" )
	}, "rootNode.create(jsonObject) will extend objDb" );

	deepEqual( debug.watchingPaths( "a" ), ["d"], "hm.create() will parse dependencies" +
	                                                "within value, and do something like " +
	                                                "hm.debug.modelLinks[watchedPaths].push(referencingPath)" );

	deepEqual( debug.watchingPaths( "d" ), ["e"], "hm.create() will parse dependencies" +
	                                                "within value, and do something like " +
	                                                "hm.debug.modelLinks[watchedPaths].push(referencingPath)" );

	equal( rootNode.get( "d" ), "a", "model.get(functionPath) will evaluate " +
	                                      "the function instead of returning the function" );
	//e-->d --> a
	//	raises( function() {
	//		rootNode.del( "a" );
	//	}, "rootNode.remove(watchedPaths) will result in exception, because the path is" +
	//	   " referenced by other path" );
	//
	//	raises( function() {
	//		rootNode.del( "d" );
	//	}, "rootNode.remove(watchedPaths) will result in exception, because the path is" +
	//	   " referenced by other path" );

	rootNode.del( "a" );
	rootNode.del( "d" );

	rootNode.del( "e" );

	equal( debug.watchingPaths( "d" ).length, 0,
		"after a path is deleted, the watch where the path is in referencing role, it is deleted. " );

	rootNode.del( "d" );

	equal( debug.watchingPaths( "a" ).length, 0,
		"after a path is deleted, the watch where the path is in referencing role, it is deleted. " );

	rootNode.del( "a" );

	ok( true, "after referencing path is removed, referenced path can be removed" );

	rootNode.del( "b" );

	assertEmptyDb();
} );

test( "remove model by force", function() {
	rootNode.extend( {
		a: "a",
		b: function() {
			return this.a;
		}
	} );

	rootNode.del( "a" );
	ok( true, "model can be deleted event it is watch by other model, after deleted the watch" +
	          "is also deleted" )

	equal( debug.watchingPaths( "a" ).length, 0, "after a path is deleted, the watch where the path is in referenced role" );

	rootNode.del( "b" );

} );

test( "model.raw()", function() {
	var fn = function() {
		return "x";
	};

	rootNode.create( "f", fn );
	equal( rootNode.raw( "f" ), fn, "you can get getfunc to return the function at the path" );
	rootNode.del( "f" );

} );

test( "model navigation1", function() {

	var originalEvaluator = hm( "a" );
	var relativeModel = originalEvaluator.cd( "b" );
	equal( relativeModel.path, "a.b", "can navigate to relative path" );
	var shadowEvaluator = originalEvaluator.shadow();
	equal( shadowEvaluator.path, "__hm.a", "can navigate to shadowModel" );
	var mainModel = shadowEvaluator.main();
	equal( mainModel.path, "a", "can navigate back to mainModel" );
	var popModel = mainModel.previous;
	equal( popModel, shadowEvaluator, "popModel can pop out the old model" );

} );

test( "model navigation2", function() {
	rootNode.extend( {
		a: {
			b: {
				c: "c"
			}
		}
	} );
	var originalmodel = hm( "a" );
	var relativeModel = originalmodel.cd( "b.c" );
	equal( relativeModel.path, "a.b.c", "can navigate to relative path" );
	var shadowModel = relativeModel.shadow();
	equal( shadowModel.path, "__hm.a#b#c", "can navigate to shadowModel" );
	var mainModel = shadowModel.main();
	equal( mainModel.path, "a.b.c", "can navigate back to mainModel" );
	var popModel = mainModel.previous;
	equal( popModel, shadowModel, "popModel can pop out the old model" );

	rootNode.del( "a" );

} );

test( "helpers", function() {
	ok( hm.util.isPrimitive( null ), "null is primitive" );
	ok( hm.util.isPrimitive( undefined ), "undefined is primitive" );
	ok( hm.util.isPrimitive( true ), "boolean is primitive" );
	ok( hm.util.isPrimitive( 1 ), "number is primitive" );
	ok( hm.util.isPrimitive( "s" ), "string is primitive" );

	var obj = {
		a: "a",
		b: "b",
		c: {
			d: "d"
		}
	}

	hm.util.clearObj( obj );
	deepEqual( obj, {
		a: null,
		b: null,
		c: {
			d: null
		}
	}, "hm.clearObj(obj) can empty primitive value inside" );

	hm( "a" ).watch( "b" );
	deepEqual( debug.watchingPaths( "b" ), ["a"], "hm.addLink will make modelLinks increment" );

	hm( "a" ).watch( "b" );
	equal( debug.watchingPaths( "b" ).length, 1, "adding the same link can not be added twice" );

	hm( "a" ).unwatch( "b" );
	equal( debug.watchingPaths( "b" ).length, 0, "hm().removeSubjectPath will remove the watch" );

	var options = hm.options;
	ok( options, "hm.options will return the options object" );

} );

test( "array method of model", function() {

	function getModelEventForCompare ( modelEvent ) {
		var rtn = {
			publisher: modelEvent.publisher.path,
			eventType: modelEvent.eventType,
			originalPublisher: modelEvent.originalPublisher.path
		};

		if ("removed" in modelEvent) {
			rtn.removed = modelEvent.removed;
		}

		return rtn;
	}

	ok( hm.fn.indexOf, "model array is defined" );
	var path = "array";
	var array = ["a", "b", "c"];
	var item1 = "d";

	rootNode.create( path, array );
	var node = hm( path );
	//	var view = {};

	var modelEventForCompare;
	var originalModelEvent;

	equal( node.first(), "a", "node.firstItem can return the last item in the array" );
	equal( node.last(), "c", "node.lastItem can return the last item in the array" );
	equal( node.count(), 3, "node.itemCount() can return the length of the array" );

	equal( node.indexOf( "b" ), 1, "node.indexOfItem return the index of item in array" );
	node.push( item1 );
	equal( array[3], item1, "node.appendItem return the index" );

	//	deepEqual( modelEventForCompare, {
	//		publisher: path,
	//		eventType: "afterCreate.child",
	//		originalPublisher: path + "." + (array.length - 1)
	//	}, "model.appendItem will trigger expected event" );

	var removedItem = node.pop();
	equal( item1, removedItem, "node.pop return the last item pushed in" );

	//	deepEqual( modelEventForCompare, {
	//		publisher: path,
	//		eventType: "afterDel.child",
	//		originalPublisher: path + ".3",
	//		removed: item1
	//	}, "model.popItem will trigger expected event" );

	node.insertAt( 1, item1 );
	deepEqual( node.get(), ["a", "d", "b", "c"], "node.insertItemAt will can create the " +
	                                                  "value at the index" );
	//	deepEqual( modelEventForCompare, {
	//		publisher: path,
	//		eventType: "afterCreate",
	//		originalPublisher: path + ".1"
	//	}, "the modelEvent in modelHandler is expected, after calling model.insertItemAt" );

	node.removeItem( item1 );

	deepEqual( array, ["a", "b", "c"], "node.removeItem is success" );

	node.unshift( item1 );

	deepEqual( array, ["d", "a", "b", "c"], "node.unshift() is success" );

	var shiftItem = node.shift();
	ok( shiftItem == item1 && array[0] == "a" && array[1] == "b" && array[2] == "c", "node.shift() is success" );

	node.replaceItem( "a", "a1" );

	node.replaceItem( "a1", "a" );
	deepEqual( array, ["a", "b", "c"], "array is reset by model.replaceItem()" );

	node.clear();

	deepEqual( array, [], "after model.clearItems() is called, the array is empty" );

	node.push( "b" );
	node.push( "c" );
	node.push( "a" );

	deepEqual( array, ["b", "c", "a"], "the result before sort is expected" );

	rootNode.del( path );
	//hm.debug.removeView( view );
	assertEmptyDb();

} );

test( "hm.mergePath", function() {

	var mergePath = hm.util.mergePath;
	var tologicalPath = hm.util.toLogicalPath;

	equal( mergePath( "a.b", undefined ), "a.b", "if index is not defined, use context as path" );

	equal( mergePath( "a.b", "." ), "a.b", "if index is '.', use context as path" );

	equal( mergePath( "a.b", ".c" ), "a.b.c", "if index is '.x', combine context and index as mergePath" );

	equal( mergePath( "a.b", "*c" ), "a.b*c", "if index is '*x', combine context and index as mergePath" );

	//equal( mergePath( "a*b", "<c" ), "a.c", "you can use '<' to traverse back to main model of the current shardow" );

	equal( tologicalPath( mergePath( "a*b", "*c" ) ), "a*b*c", "if context is a*b,  index is *c, mergePath is a*b*c" );

	equal( mergePath( "a", "..c" ), "c", "if index is '..x', combine context's context and index as mergePath" );

	equal( mergePath( "a.b", "..c" ), "a.c", "if index is '..x', combine context's context and index as mergePath" );

	equal( mergePath( "a.b.c", "...d" ), "a.d", "if index is '...x', combine context's context and index as mergePath" );

	equal( mergePath( "a.b.c.d", "....e" ), "a.e", "if index is '....x', combine context's context and index as mergePath" );

	equal( mergePath( "a.b", ".*c" ), "a*c", "if index is '.*c', combine context's context and index as mergePath" );

	equal( mergePath( "a.b.c", "..*d" ), "a*d", "if index is '..*d', combine context's context and index as mergePath" );

	equal( mergePath( "a.b.c.d", "...*e" ), "a*e", "if index is '...*x', combine context's context and index as mergePath" );

	equal( mergePath( "a.b", "/d" ), "d", "you can use '/d' to get top level child d" );

	equal( mergePath( "a.b", "/" ), "", "you can use '/' to get root" );

} );

test( "model.getPath", function() {
	var model = hm( "a.b.c" );

	equal( model.getPath(), "a.b.c", "if subPath is not defined, return the model's path" );

	equal( model.getPath( "d" ), "a.b.c.d",
		"if subpath does not have startPath like '*' or '.', by default is child path" );

	equal( model.getPath( ".d" ), "a.b.c.d",
		"if subpath has startPath like '.', it will used that" );

	equal( model.getPath( "*d" ), "a.b.c*d",
		"if subpath has startPath like '.', it will used that" );

	equal( model.getPath( ".." ), "a.b", "you can use '..' to go up one level" );

	equal( model.getPath( "..d" ), "a.b.d", "you can use '..d' to get slibling d" );

	equal( model.getPath( "/d" ), "d", "you can use '/d' to get toplevel children d" );

	equal( model.getPath( "/" ), "", "you can use '/' to get root" );

} );

test( "model method", function() {
	hm.set( "adhoc", {
		x: 1,
		y: 2,
		calculate: function( operator ) {
			switch (operator) {
				case '+':
					return this.get( "x" ) + this.get( "y" );
				case '-':
					return this.get( "x" ) - this.get( "y" );
				case '*':
					return this.get( "x" ) * this.get( "y" );
				case '/':
					return this.get( "x" ) / this.get( "y" );
			}
		},
		firstName: "",
		lastName: "",
		changeName: function( firstName, lastName ) {
			//this point to the current model object
			this.set( "firstName", firstName );
			this.set( "lastName", lastName );
		}
	} );

	ok( $.isFunction( hm().raw( 'adhoc.calculate' ) ), 'hm.helper can return a function' );
	equal( hm.get( "adhoc.calculate", "+" ), 3,
		"If a model.raw(path) is a function, model.get(path, p1, p2) will run in the raw context" );

	ok( $.isFunction( hm().raw( 'adhoc.changeName' ) ), 'hm.helper can return a function' );
	hm.set( "adhoc.changeName", "john", "doe" );

	ok( hm.get( 'adhoc.firstName' ) == 'john' && hm.get( 'adhoc.lastName' ) == 'doe',
		"If a model.raw(path) is a function, model.set(path, p1, p2) will execute the function," +
		"and the function's context is model itself" );
	assertEmptyDb();

} );

test( "node utilities", function() {

	ok( hm( "unexistNode" ).compare(), "if compare with nothing, then it behave like isEmpty() " );

	var number = hm( "number", 7 );
	ok( number.compare( 7 ), "if compare with non-string value, it use equal operator to compare " );
	ok( number.compare( "7" ),
		"If compared with string value, it will try to convert it to non-string value first, and try " +
		"to compare it using equal operator" );

	ok( number.compare( "==8-1" ),
		"If compared with string value, it can not be converted to non-string value first, will " +
		"use eval to compare" );

	var s1 = hm( "string", "abc" );

	ok( s1.compare( "=='abc'" ),
		"If compared with string value, it can not be converted to non-string value first, will " +
		"use eval to compare" );

	ok( s1.compare( "abc" ),
		"If compared with string value, it can not be converted to non-string value first, will " +
		"use eval to compare, if eval throw exception, it will use equal operator to" +
		"compare" );

} );

