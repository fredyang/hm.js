module( "subscription.js" );

var debug = hm.debug;
var getActivity = hm.activity.get;
var setActivity = hm.activity.set;
var convertActivity = hm.activity.convert;
var initializeActivity = hm.activity.initialize;
var finalizeActivity = hm.activity.finalize;

getActivity.fakeGet = function() {};
setActivity.fakeSet = function( value, e ) {
	this.set( value );
};
convertActivity.fakeConvert = function() {};
initializeActivity.fakeInitialize = function() {};
finalizeActivity.fakeFinalize = function() {};

test( "model events match test", function() {

	var getMatchedSubscribedEvent = debug.getMatchedSubscribedEvent;

	ok( getMatchedSubscribedEvent( "*", "whatever" ), "* match all what ever event" );
	ok( getMatchedSubscribedEvent( "*", "whatever.whatever" ), "* match all what ever event" );

	ok( getMatchedSubscribedEvent( "whatever", "whatever" ), "support exact match" );
	ok( getMatchedSubscribedEvent( "whatEver", "whatever" ), "support case insentive match exact match" );
	ok( getMatchedSubscribedEvent( "whatever.whatever", "whatever.whatever" ), "support exact match" );

	ok( !getMatchedSubscribedEvent( "whatever", "whatever.whatever" ), "if there is no wildcard *, use exact match" );

	ok( getMatchedSubscribedEvent( "*.", "whatever" ), "*. match all current node" );
	ok( !getMatchedSubscribedEvent( "*.", "whatever.whatever" ), "*. does not match event with extension" );

	ok( getMatchedSubscribedEvent( "before*", "beforeUpdate" ), "before* match beforeUpdate" );
	ok( getMatchedSubscribedEvent( "before*", "beforeUpdate.parent" ), "before* match beforeUpdate.parent" );

	ok( getMatchedSubscribedEvent( "before*.", "beforeUpdate" ), "before* match beforeUpdate" );
	ok( !getMatchedSubscribedEvent( "before*.", "beforeUpdate.parent" ), "before*.  does not match beforeUpdate.parent" ); //

	ok( getMatchedSubscribedEvent( "before*.parent", "beforeUpdate.parent" ), "before*.parent matches beforeUpdate.parent" );
	ok( !getMatchedSubscribedEvent( "before*.parent", "beforeUpdate" ), "before*.parent  does not match beforeUpdate.parent" );
	ok( !getMatchedSubscribedEvent( "before*.parent", "update.parent" ), "before*.parent  does not match update.parent" );

	ok( getMatchedSubscribedEvent( "*.parent", "update.parent" ), "*.parent match update.parent" );
	ok( !getMatchedSubscribedEvent( "*.parent", "beforeUpdate" ), "*.parent does not match beforeUpdate" );

	ok( getMatchedSubscribedEvent( "afterUpdate afterCreate", "afterCreate" ), "combo events can match single event" );

	ok( getMatchedSubscribedEvent( "afterUpdate before*", "beforeUpdate" ), "combo events with before* can match beforeUpdate" );
	ok( getMatchedSubscribedEvent( "afterUpdate before*", "beforeUpdate.child" ), "combo events with before* can match beforeUpdate.child" );
	ok( getMatchedSubscribedEvent( "afterUpdate before*.", "beforeUpdate" ), "combo events with before*. can match beforeUpdate" );
	ok( !getMatchedSubscribedEvent( "afterUpdate before*.", "beforeUpdate.parent" ), "combo events with before*. can not match beforeUpdate.child" );

} );

test( "subscriptions count after subscribe/unsubscribe", function() {
	hm( "b" ).sub( "a", "afterUpdate" );
	hm( "e" ).sub( "a", "afterUpdate" );
	hm( "c" ).sub( "a", "afterUpdate" );
	hm( "d" ).sub( "c", "afterUpdate" );
	hm( "e" ).sub( "c", "afterUpdate" );
	equal( hm.subscription.getAll().length, 5, "subscriptions added after subscribing" );

	debug.unsub( "c" );
	equal( hm.subscription.getAll().length, 2,
		"unsubcribing will remove all subscriptions where object is either publisher or subscriber" );

	debug.unsub( "a" );

	equal( hm.subscription.getAll().length, 0,
		"unsubscribing will remove all subscriptions where object is either publisher or subscriber" );

	hm.set( "c", "c" );
	hm( "c" ).sub( "a", "afterUpdate" );
	hm( "d" ).sub( "c", "afterUpdate" );
	hm( "e" ).sub( "c", "afterUpdate" );
	equal( hm.subscription.getAll().length, 3 );
	hm.del( "c" );
	equal( hm.subscription.getAll().length, 0, "delete a model will also unsubscribe the model" );

	var jqueryView = $( "<div></div>" ).appendTo( testArea() );
	jqueryView.sub( "a", "afterUpdate", "html" );
	hm( "c" ).sub( jqueryView, "change", "html" );
	equal( hm.subscription.getAll().length, 2, "subscriptions added after subscribing" );
	jqueryView.remove();
	equal( hm.subscription.getAll().length, 0, "removing view can also remove view's subscriptions" );
	assertEmptyDb();
} );

test( "build workflow with activities", function() {
	var isModel = true;
	var isView = false;

	var buildWorkflowType = debug.buildWorkflowType;
	var workflowInstance;

	hm.fn.fakeSetModel = function() {};
	hm.fn.fakeGetModel = function() {};
	$.fn.fakeGetView = function() {};
	workflowInstance = buildWorkflowType( "fakeGetView set" );

	deepEqual( workflowInstance,
		{
			get: debug.getMember,
			getName: "fakeGetView",
			set: debug.setMember,
			setName: "set"
		},

		"If a model subscribe a jQueryView and there is only one method in handler, handler.get is for get" +
		" view, and handler.set is for set mode" );
	workflowInstance = buildWorkflowType( "fakeGetModel fakeSetView *fakeConvert *fakeFinalize *fakeInitialize" );

	deepEqual( workflowInstance, {
		get: debug.getMember,
		getName: "fakeGetModel",
		set: debug.setMember,
		setName: "fakeSetView",
		convert: convertActivity.fakeConvert,
		initialize: initializeActivity.fakeInitialize,
		finalize: finalizeActivity.fakeFinalize
	}, "you can totally setup up to six filter for the handler in a string" );

	workflowInstance = buildWorkflowType( "get set _ null" );

	deepEqual( workflowInstance, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "set"
	}, "you can bypass certain method using null or _" );

} );

test( "model subscribe model event", function() {
	var name = "john";
	hm.set( "name", name );
	hm.set( "name2", "" );

	hm( "name2" ).sub( "name", "init afterUpdate" );

	equal( hm.get( "name2" ), name,
		"If model subscribe an other model, and handler is missing,  the handler use model.get " +
		"and model.set as handler" );

	var handler = hm( "name2" ).subsFromMe()[0].handler;

	deepEqual( handler, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "set"
	}, "If model subscribe an other model, and handler is missing,  the handler use model.get " +
	   "and model.set as handler" );

	ok( hm.get( "name2" ) == name,
		"If model subscribe an other model, and handler is missing,  the handler use model.get " +
		"and model.set as handler" );

	var newName = "tom";
	hm.set( "name", newName );

	equal( hm.get( "name2" ), newName,
		"if model subscribe an other model, and handler is missing,  the handler use model.get " +
		"and model.set as handler" );

	debug.unsub( "name2" );

	hm.fn.setName2 = function( value ) {
		this.set( value );
	};

	hm( "name2" ).sub( "name", "afterUpdate", "setName2" );

	handler = hm( "name2" ).subsFromMe()[0].handler;
	deepEqual( handler, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "setName2"
	}, "If a model subscribe another model, and the handler has only one filter, this" +
	   "filter will be 'set filter'" );

	hm.set( "name", "xxx" );

	equal( hm.get( "name2" ), "xxx",
		"If a model subscribe another model, and the handler has only one filter, this" +
		"filter will be 'set filter'" );

	handler = hm( "name2" ).subsFromMe()[0].handler;

	deepEqual( handler, {
			get: debug.getMember,
			getName: "get",
			set: debug.setMember,
			setName: "setName2"
		},
		"If model subscribe another model, and handler has only one filter, this filter will be set filter" );

	debug.unsub( "name2" );
	delete hm.fn.setName2;

	hm( "name2" ).sub( "name", "afterUpdate", "get *fakeSet" );

	hm.set( "name", "yyy" );
	handler = hm( "name2" ).subsFromMe()[0].handler;

	deepEqual( handler, {
			get: debug.getMember,
			getName: "get",
			set: setActivity.fakeSet
		},
		"you can use a common set filter" );

	debug.unsub( "name2" );

	hm.set( "setName2", function( value ) {
		this.set( "..name2", value );
	} );

	hm( "setName2" ).sub( "name", "afterUpdate" );
	hm.set( "name", "zzz" );
	equal( hm.get( "name2" ), "zzz", "a model function can be used as setter" );

	assertEmptyDb();

} );

test( "view subscribe model event", function() {
	hm.set( "markup", "hello" );
	var $view = $( "<div></div>" ).appendTo( testArea() );

	$view.sub( "markup", "init afterUpdate", "html" );
	var handler = $view.subsFromMe()[0].handler;
	deepEqual( handler, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "html"
	}, "If a view subscrbe model and there is only one filter in the handler," +
	   " the handler is get the model value, and set the view with the filter set" );

	equal( $view.html(), hm.get( "markup" ),
		"When a view subscribe a model, and handler is a single" +
		"string, the handler is get model and set view" );

	var newMarkup = "bye"
	hm.set( "markup", newMarkup );
	equal( $view.html(), newMarkup,
		"When a view subscribe a model, and handler is a single" +
		"string, the handler is get model and set view" );

	debug.unsub($view[0]);

	hm.set( "color", "white" );
	$view.sub( "color", "init afterUpdate", "css*color" );
	handler = $view.subsFromMe()[0].handler;

	deepEqual( handler, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "css",
		setParas: "color"
	}, "If a jquery view subscribe model and there is only one filter in the handler," +
	   " the handler is get the model value, and set the view with the filter set, if the " +
	   "set filter is property method, then the property name can be inferred from the index " +
	   "of model path" );

	equal( $view.css( "color" ), "rgb(255, 255, 255)", "when a view subscribe model, the handler" +
	                                                   "is get model and set view. If the set view" +
	                                                   "is a special property, the set method will" +
	                                                   "try to use the index of model path as the property" +
	                                                   "name" );

	hm.set( "color", "black" );
	equal( $view.css( "color" ), "rgb(0, 0, 0)",
		"when a jquery view subscribe model, the handler" +
		"is get model and set view. If the set view" +
		"is a special property, the set method will" +
		"try to use the index of model path as the property" +
		"name" );

	debug.unsub($view[0]);

	equal( hm.subscription.getAll().length, 0, "unsubscribe successfully" );

	hm.set( "name", "john" );
	hm.set( "handlerNameChangeForView", function( e ) {
		//this == a view
		//e.publisher == a model
	} );

	//renderView(path, handler, options)

	$view.renderView( "name", "html" );

	equal( hm.subscription.getAll().length, 0,
		"renderView behavie like init event, which does not create any subscriptions" );

	equal( $view.html(), hm.get( "name" ), "renderView will run the handler once" );

	var jsObjectView = {
		name: "",
		setName: function( value ) {
			this.name = value;
		}
	};

	$( jsObjectView ).sub( "name", "init afterUpdate", "name" );

	var subscriptions = $( jsObjectView ).subs();
	equal( subscriptions.length, 1, "jsObjectView can also subscribe model event" );
	handler = subscriptions[0].handler;

	deepEqual( handler, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "name"
	}, "If a object view subscrbe model and there is only one filter in the handler," +
	   " the handler is get the model value, and set the view with the filter set" );

	equal( jsObjectView.name, hm.get( "name" ), "jsObjectView's member property can be used as handler" );
	var newName = "newName";
	hm.set( "name", newName );
	equal( jsObjectView.name, hm.get( "name" ), "externalView's member property can be used as handler" );
	debug.unsub( jsObjectView );

	subscriptions = $( jsObjectView ).subs();
	equal( subscriptions.length, 0, "object view can be unsubscribed" );

	$( jsObjectView ).sub( "name", "afterUpdate", "setName" );
	handler = $( jsObjectView ).subsFromMe()[0].handler;
	deepEqual( handler, {
		get: debug.getMember,
		getName: "get",
		set: debug.setMember,
		setName: "setName"

	}, "If a object view subscrbe model and there is only one filter in the handler," +
	   " the handler is get the model value, and set the view with the filter set" );

	newName = newName + "1";
	hm.set( "name", newName );
	equal( jsObjectView.name, hm.get( "name" ), "jsObjectView's member function can be used as handler" );
	debug.unsub( jsObjectView );

	assertEmptyDb();
} );

test( "model subscribe view event", function() {

	var customerName = "john";
	var jQueryView = $( "<input type='text' />" ).val( customerName ).appendTo( testArea() );
	hm.set( "customer", "" );

	hm( "customer" ).sub( jQueryView, "init change", "val" );

	var handler = hm( "customer" ).subsFromMe()[0].handler;

	deepEqual( handler, {
		get: debug.getMember,
		getName: "val",
		set: debug.setMember,
		setName: "set"

	}, "If a model subscribe to a jQueryView, there is only one filter in the handler," +
	   " the handler is get the view value using filter, and set the model" );

	equal( hm.get( "customer" ), customerName, "If a model subscribe to jQueryView's init event," +
	                                           "model will be set immediately with the value of the jQueryView" );

	var newCustomerName = "tom";
	jQueryView.val( newCustomerName ).trigger( "change" );

	equal( hm.get( "customer" ), newCustomerName, "If a model subscribe to jQueryView event," +
	                                              "when event happen, model will get set" );

	debug.unsub( "customer" );

	var viewHandler = function( e, firstName, lastName ) {
		this.set( firstName + "," + lastName );
	};

	hm( "customer" ).sub( jQueryView, "change", viewHandler );
	handler = hm( "customer" ).subsFromMe()[0].handler;
	deepEqual( handler.get, viewHandler, "If a model subscribe to a jQueryView, and the handler is just a function," +
	                                     " the function is the real handler." );

	jQueryView.trigger( "change", ["a", "b"] );

	equal( hm.get( "customer" ), "a,b",
		"The original jQuery trigger with extra parameters still works in the view handler" );

	debug.unsub( "customer" );

	//compare with line 437
	hm.set( "setCustomer", function x ( e ) {
		equal( x, e.handler.get,
			"If a model subscribe directly to the view, and the handler is missing, " +
			"the model is the handler by itself, in the handler, " +
			"the 'this' refer to the handler, but not the model proxy, " +
			"the 'e' refer to the event argument but not the value to be set into model" );
		this.set( "..customer", e.publisher.val() );
	} );

	hm( "setCustomer" ).sub( jQueryView, "change" );
	handler = hm( "setCustomer" ).subsFromMe()[0].handler;

	deepEqual( handler.get, hm().raw( "setCustomer" ),
		"If a model subscribe directly to the view and the handler is missing, " +
		"then the model is the handler by itself" );

	newCustomerName = newCustomerName + "1";
	jQueryView.val( newCustomerName ).trigger( "change" );

	equal( hm.get( "customer" ), newCustomerName, "if model subscribe view's event without " +
	                                              "specifying handler, then the model is the handler" +
	                                              " by itself" );
	debug.unsub( "setCustomer" );
	//
	//compare with line 401
	hm().raw( "setCustomer", function( value ) {
		ok( this.path == "" && this instanceof hm,
			"If model's data is itself a function, setting the model will actually call" +
			"the model function, with a value parameter, in the function 'this' refer" +
			"to the model object" );
		equal( value, newCustomerName );
		this.set( "customer", value );
	} );

	hm( "setCustomer" ).sub( jQueryView, "change", "val" );
	handler = hm( "setCustomer" ).subsFromMe()[0].handler;

	deepEqual( handler, {
		get: debug.getMember,
		getName: "val",
		set: debug.setMember,
		setName: "set"
	}, "when a model subscribe a view handler, and the filter is a single filter, that single" +
	   "filter is to get view value" );

	newCustomerName = newCustomerName + "1";
	jQueryView.val( newCustomerName ).trigger( "change" );
	equal( hm.get( "customer" ), newCustomerName, "you can use model as a setter of handler" );

	debug.unsub( "setCustomer" );

	var objectView = {
		customer: "xx",
		getCustomer: function() {
			return this.customer;
		},
		setCustomer: function( value ) {
			this.customer = value;
			$( this ).trigger( "change" );
		}
	};

	hm( "customer" ).sub( objectView, "init change", "customer" );

	equal( hm.get( "customer" ), objectView.customer,
		"a plain javascript object can be also used a publisher" );

	newCustomerName = objectView.customer + "1";
	objectView.setCustomer( newCustomerName );

	equal( hm.get( "customer" ), newCustomerName,
		"a plain javascript object can be also trigger event which can be subscribed" );

	debug.unsub( "customer" );

	hm( "customer" ).sub( objectView, "change", "getCustomer" );

	newCustomerName = objectView.customer + "1";
	objectView.setCustomer( newCustomerName );

	equal( hm.get( "customer" ), newCustomerName,
		"a plain javascript object's member function can be used as getter" );

	assertEmptyDb();
} );

test( "view subscribe view event", function() {

	var $textboxs = $( "<input id='txt1' type='text' value='text1' /><input id='txt2' " +
	                   "type='text' value='text2' />" ).appendTo( testArea() );

	var $labels = $( "<div id='label1'></div><div id='label2'></div><div id='label3'></div>" ).appendTo( testArea() );

	//or
	// $( "#label1, #label2, #label3" ).subscribe( "$#txt1, #txt2", "change", "val html" );
	$( "#label1, #label2, #label3" ).sub( $( "#txt1, #txt2" ), "change", "val html" );

	equal( hm.subscription.getAll().length, 6, "using jQuery selector as publisher/subscriber will" +
	                                   "expand them first" );
	var val1 = "john";
	$( "#txt1" ).val( val1 ).trigger( "change" );

	ok( $( "#label1" ).html() == val1 && $( "#label2" ).html() == val1 && $( "#label3" ).html() == val1,
		"multiple subscriber can get change form one publisher" );

	var val2 = "tom";
	$( "#txt2" ).val( val2 ).trigger( "change" );

	ok( $( "#label1" ).html() == val2 && $( "#label2" ).html() == val2 && $( "#label3" ).html() == val2,
		"multiple subscriber can get change form one publisher" );

	$( "#txt1" ).remove();

	equal( hm.subscription.getAll().length, 3, "hm.subscription.getAll().remove will only remove relative publisher/subscriber" );

	$( "#label3" ).remove();

	equal( hm.subscription.getAll().length, 2, "hm.subscription.getAll().remove will only remove relative publisher/subscriber" );

	$( "#txt2" ).remove();

	equal( hm.subscription.getAll().length, 0, "hm.subscription.getAll().remove will only remove relative publisher/subscriber" );

	assertEmptyDb();
} );

test( "model event propagation", function() {
	rootNode.extend( {
		customer: {
			firstName: null,
			lastName: null,
			fullName: function() {
				return this.get( "firstName" ) + "," + this.get( "lastName" );
			}
		}
	} );

	var subscriber;
	var publishers = [];
	var originalPublishers = [];

	hm.handle( "customer.firstName", "afterUpdate", function( e ) {
		subscriber = this;
	} );

	hm.handle( "customer", "afterUpdate.*", function( e ) {
		publishers.push( e.publisher.path );
		originalPublishers.push( e.originalPublisher.path );
	} );

	rootNode.set( "customer.firstName", "fred" );
	equal( subscriber, window, "subscriber can be null" );

	deepEqual( publishers, ["customer", "customer"],
		"the publisher is always the current publisher" );

	deepEqual( originalPublishers, ["customer.fullName", "customer.firstName"],
		"event propogate to dependent first, and then up, this is similar like wide first, " +
		"then deep, when dependent bubblle up, it change the original hierachy" );

	equal( hm.subscription.getAll().length, 2 )
	hm.del( "customer" );
	equal( hm.subscription.getAll().length, 0, "delete a model will delete all handler that attached to its" +
	                                   "descendants" )
	assertEmptyDb();

} );

test( "model event abortion", function() {
	rootNode.extend( {
		customer: {
			firstName: null,
			lastName: null,
			fullName: function() {
				return this.get( "firstName" ) + "," + this.get( "lastName" );
			}
		}
	} );

	hm().sub( "customer.firstName", "beforeUpdate", function( e ) {
		e.error();
	} );

	rootNode.set( "customer.firstName", "john" );
	equal( rootNode.get( "customer.firstName" ), null,
		"if model event for beforeUpdate set error, it will not succeed" );

	debug.unsub( "customer.firstName" );

	hm().sub( "customer", "beforeUpdate.*", function( e ) {
		e.error();
	} );

	rootNode.set( "customer.firstName", "john" );

	equal( rootNode.get( "customer.firstName" ), null,
		"if model event for beforeUpdate.child set error, it will not succeed" );

	debug.unsub( "customer" );

	hm().sub( "customer.fullName", "beforeUpdate", function( e ) {
		e.error();
	} );

	rootNode.set( "customer.firstName", "john" );

	equal( rootNode.get( "customer.firstName" ), null,
		"if beforeUpdate model event for dependent model  set error, it will not succeed" );

	debug.unsub( "customer" );

	hm().sub( "customer", "beforeUpdate.*", function( e ) {
		e.error();
	} );

	rootNode.set( "customer.firstName", "john" );

	equal( rootNode.get( "customer.firstName" ), null,
		"if beforeUpdate.childe model event for dependent model  set error, it will not succed" );

	debug.unsub( "customer" );
	equal( hm.subscription.getAll().length, 0 );

	hm().sub( "customer.firstName", "afterUpdate", function( e ) {
		e.stopCascade();
	} );

	var customerHandlerCalled = false;
	var originalPublisher;
	hm().sub( "customer", "afterUpdate.*", function( e ) {
		customerHandlerCalled = true;
		originalPublisher = e.originalPublisher.path;
	} );

	rootNode.set( "customer.firstName", "john" );
	equal( customerHandlerCalled, true,
		"e.stopCascade will stop model event from  side progagation" );

	equal( originalPublisher, "customer.firstName",
		"original publisher come from the original hierachy" );

	debug.unsub( "customer" );
	equal( hm.subscription.getAll().length, 0 );

	hm().sub( "customer.firstName", "afterUpdate", function( e ) {
		e.stopPropagation();
	} );
	customerHandlerCalled = false;
	originalPublisher = "";

	hm().sub( "customer", "afterUpdate.*", function( e ) {
		customerHandlerCalled = true;
		originalPublisher = e.originalPublisher.path;
	} );

	rootNode.set( "customer.firstName", "tom" );

	equal( customerHandlerCalled, true,
		"e.stopPropagation will stop model event from  progagation from the original hierachy" );

	equal( originalPublisher, "customer.fullName",
		"original publisher come from the side hierachy" );

	//
	debug.unsub( "customer" );
	equal( hm.subscription.getAll().length, 0 );

	customerHandlerCalled = false;
	originalPublisher = "";
	var publishers = [];
	hm().sub( "customer", "afterUpdate.*", function( e ) {
		customerHandlerCalled = true;
		publishers.push( e.originalPublisher.path );
	} );

	rootNode.set( "customer.firstName", "cat" );

	equal( customerHandlerCalled, true, "by default, all propogation is allowed" );

	deepEqual( publishers, ["customer.fullName", "customer.firstName"],
		"customer's afterUpdate.childe handler is called twice" +
		" because of propgation up from both fullName and firstName, and side hierachy propogation come" +
		" first of original hierachy propogation" );

	//reset
	debug.unsub( "customer" );
	equal( hm.subscription.getAll().length, 0 );

	customerHandlerCalled = false;
	originalPublisher = "";
	hm().sub( "customer.firstName", "afterUpdate", function( e ) {
		e.stopImmediatePropagation();
	} );

	hm().sub( "customer", "afterUpdate.*", function( e ) {
		customerHandlerCalled = true;
	} );

	rootNode.set( "customer.firstName", "lion" );

	equal( customerHandlerCalled, false, "stopImmediatePropagation will stop all propogation" );
	assertEmptyDb();
} );

test( "simple function as workflow", function() {

	var name = "john";
	hm.set( "name", name );
	hm.set( "name2", "" );

	var simpleHandler = function( e ) {
		equal( e.handler.get, simpleHandler, "a simple handler is the get function of workflow" );
		equal( e.handler.seed, 100, "handler's init is called" );
		this.set( e.publisher.get() );
	};

	var init = function( publisher, subscriber, workflow, options ) {
		workflow.seed = "100";
	};

	simpleHandler.initialize = init;

	hm.workflow( "simpleHandler", simpleHandler );

	hm( "name2" ).sub( "name", "init afterUpdate", "*simpleHandler" );
	equal( hm.get( "name2" ), hm.get( "name" ), "the simple function is called" );

	assertEmptyDb();

} );

test( "object as workflow", function() {
	var name = "john"
	hm.set( "name", name );
	hm.set( "name2", "" );

	var workflow = {
		get: function( e ) {
			ok( (arguments.callee == workflow.get) && (e.handler.get == workflow.get),
				"full handler's object's get function is used" );

			ok( e.handler.initialize, " after workflow instance is initialized, the the initialize is not deleted" );
			return e.publisher.get() + e.handler.seed;
		},

		set: function( value, e ) {
			this.set( value );
		},

		convert: function( value, e ) {
			return value + e.handler.seed;
		},

		initialize: function( publisher, subscriber, workflowInstance, option ) {
			equal( publisher.path, "name", "publisher is passed into init" );
			equal( subscriber.path, "name2", "subcriber is passed into init" );
			//
			notEqual( workflowInstance, workflow, "The workflow instance is not the same as the workflow type" );
			deepEqual( workflowInstance, workflow, "workflowInstance an instance of workflow type" );
			//
			equal( option, externalOptions, "options object is passed into init" );
			workflowInstance.seed = option.seed;
		}
	};
	var externalOptions = {
		seed: "x"
	};

	hm.workflow( "dummyWorkflow", workflow );

	hm( "name2" ).sub( "name", "init afterUpdate", "*dummyWorkflow", externalOptions );

	equal( hm.subscription.getAll().length, 1, "a subscription addd a entry to subscriptions" );
	equal( hm.subscription.getAll()[0].eventTypes, "afterUpdate", "the init event is discarded" );
	//
	equal( hm.get( "name2" ), name + externalOptions.seed + externalOptions.seed,
		"the init event update the subscriber immediately, the handlers passed get/convert/set 3 stages" );

	var newName = "tom"
	hm.set( "name", newName );

	equal( hm.get( "name2" ), newName + externalOptions.seed + externalOptions.seed,
		"the afterUpdate event update subscriber after publisher is updated" );

	assertEmptyDb();

} );

test( "common workflow as workflow", function() {
	var name = "john"
	hm.set( "name", name );
	hm.set( "name2", "" );
	var workflow = {

		get: function( e ) {
			return e.publisher.get() + e.handler.seed;
		},
		set: function( value, e ) {
			this.set( value );
		},
		convert: function( value, e ) {
			return value + e.handler.seed;
		},
		initialize: function( publisher, subscriber, pipeline2, options2 ) {
			pipeline2.seed = options2.seed;
		}
	};
	var options = {
		seed: "x"
	};

	hm.workflow( "test", workflow );

	hm( "name2" ).sub( "name", "init afterUpdate", "*test", options );
	equal( hm.get( "name2" ), hm.get( "name" ) + options.seed + options.seed,
		"the handlers passed get/convert/set 3 stages" );

	assertEmptyDb();
} );

test( "use common getter/setter/converter/initializer/finalizer to build workflow type", function() {

	var initCalled,
		getCalled,
		convertCalled,
		setCalled,
		finalizedCalled,
		ageChanged,
		finalizedValue;

	getActivity.testGet = function( e ) {
		getCalled = true;
		return e.publisher.val();
	};

	setActivity.testSet = function( value, e ) {
		setCalled = true;
		this.set( value );
	};

	convertActivity.testConvert = function( value ) {
		convertCalled = true;
		return +value;
	};

	initializeActivity.testInit = function( publisher, subscriber, pipeline, options ) {
		initCalled = true;

		//		var eventName = hm.util.getUniqueViewEventTypes( "change", publisher, subscriber.path );
		//
		//		$( publisher ).bind( eventName, function() {
		//			ageChanged = !ageChanged;
		//			if ($.isNumeric( $( this ).val() )) {
		//				$( this ).trigger( "ageChange" );
		//			}
		//		} );
	};

	finalizeActivity.testFinalize = function( value ) {
		finalizedCalled = true;
		finalizedValue = value;
	};

	hm.set( "age", null );

	var age = 100;
	var $text = $( "<input type='text' />" ).appendTo( testArea() );

	hm( "age" ).sub( $text, "change", "*testGet *testSet *testConvert *testFinalize *testInit" );
	$text.val( age ).trigger( "change" );

	ok( getCalled && convertCalled && setCalled && finalizedCalled,
		"common getter/setter/converter/finalizer have been called" );

	ok( initCalled, "initializeActivity is also called for workflow instance" );
	getCalled = convertCalled = setCalled = finalizedCalled = false;

	ok( hm.get( "age" ) === age, "getActivity, setActivity, convertActivity, initializeActivity works together" );

	debug.unsub( "age" );
	$text.val( age ).trigger( "change" );

	hm.workflow( "testHandler", "*testGet *testSet *testConvert *testFinalize *testInit" );
	var testHandler = hm.workflow( "testHandler" );

	ok( testHandler.get == getActivity.testGet &&
	    testHandler.set == setActivity.testSet &&
	    testHandler.convert == convertActivity.testConvert &&
	    testHandler.initialize == initializeActivity.testInit,
		"hm.workflow type can be built successfully"
	);

	hm( "age" ).sub( $text, "change", "*testHandler" );
	var newAge = 200;
	$text.val( newAge ).trigger( "change" );

	ok( initCalled && getCalled && convertCalled && setCalled && finalizedCalled,
		"common initializer/getter/setter/converter/finalizer have been called for workflow type" );

	ok( hm.get( "age" ) === newAge, "we can also use same pattern to build workflow type" );

	assertEmptyDb();
} );

test( "use embedded getter/setter/converter/initializer/finalizer to build workflow", function() {
	var setCalled,
		convertCalled,
		finalizedCalled;

	hm.extend( {

		testSet: function( value ) {
			setCalled = true;
			this.set( "..age", value );
		},

		testConvert: function( value, e ) {
			convertCalled = true;
			return +value;
		},

		testFinalize: function( value ) {
			finalizedCalled = true;
		}
	} );

	hm.set( "age", null );

	var age = 100;
	var $text = $( "<input type='text' />" ).appendTo( testArea() );

	hm( "testSet" ).sub( $text, "change", "val set #..testConvert #..testFinalize" );
	$text.val( age ).trigger( "change" );

	ok( hm.get( "age" ) === age && convertCalled && finalizedCalled,
		"embedded converter/finalizer have been called" );

	debug.unsub( "testSet" );

	assertEmptyDb();

} );

test( "asynchronous workflow", function() {

	var name = "john";
	hm.set( "name", name );

	var defer;
	var $div = $( "<div></div>" ).appendTo( testArea() );
	$div.sub( "name", "init", {
		get: function( e ) {
			defer = $.Deferred();
			defer.e = e;
			return defer.promise();
		},
		set: "html"
	} );

	equal( $div.html(), "", "before defer is resolved, the set function is waiting" );
	defer.resolve( defer.e.publisher.get() + "1" );
	equal( $div.html(), name + "1", "after defer is resolved, the set function continue" );

	assertEmptyDb();
} );

test( "hm.newJqEvent", function() {

	hm.set( "lightOn", null );

	var $text = $( "<input type='text'>" ).appendTo( testArea() );

	hm.newJqEvent( "overlimit", "change", function( e ) {
		return ($( e.target ).val() > 100);
	} );

	hm( "lightOn" ).sub( $text, "overlimit", function( e ) {
		this.set( true );
	} );

	$text.val( 101 ).trigger( "change" );

	strictEqual( hm.get( "lightOn" ), true, "we can relay one event to another event, if conditon is met" );

	assertEmptyDb();

} );

test( "hmFn.mapEvent", function() {

	var inventoryNode = hm( "inventory", 100 );
	inventoryNode.mapEvent( "afterUpdate", "inventoryChange" );
	inventoryNode.mapEvent( "afterUpdate", "inventoryRise", function( e ) {
		return (e.proposed > e.removed);
	} );

	var inventory = 200;
	hm.handle( inventoryNode, "inventoryChange", function( e ) {
		equal( e.publisher.get(), inventory,
			"node.mapEvent works because inventoryChange triggered" );
	} );

	hm.handle( inventoryNode, "inventoryRise", function( e ) {
		equal( e.publisher.get(), inventory,
			"node.mapEvent works because inventoryRise triggered" );
	} );

	hm( "inventory" ).set( inventory );
	assertEmptyDb();
	expect( 3 );
} );

test( "$fn.mapEvent", function() {

	var $button = $( "<input type='button' value='y' />" ).appendTo( testArea() ).mapEvent( "click", "xEvent" );

	$button.mapEvent( "click", "yEvent", function( e ) {
		return e.publisher.val() == "y";
	} );

	$button.bind( "xEvent", function() {
		ok( true, "$obj.mapEvent works with no condition function" );
	} );

	$button.bind( "yEvent", function() {
		ok( true, "$obj.mapEvent works with condition function" );
	} );

	$button.click();
	$button.remove();

	assertEmptyDb();
	expect( 3 );
} );

