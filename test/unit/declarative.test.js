module( "declarative.js" );

var debug = hm.debug;

test( "Binding constructor", function() {
	var Binding = hm.Binding;
	var emptyBinding = new Binding();

	ok( emptyBinding.ns === undefined &&
	    emptyBinding.subscriptions.length == 0,
		"empty subscription group is empty"
	);

	function fakeSubEvents( i ) {
		return "\t\n!events" + i + ":publisher" + i + "|handler" + i + "|options" + i + "|delegate" + i + ";\t\n";
	}

	function fakePubEvents( i ) {
		return "\t\n$events" + i + ":subscriber" + i + "|handler" + i + "|options" + i + "|delegate" + i + ";\t\n";
	}

	var subText = "";
	for (var i = 0; i < 5; i++) {
		subText += fakeSubEvents( i );
		subText += fakePubEvents( i );
	}

	var g1 = new Binding( subText );

	ok( g1.ns === "" &&
	    g1.pub.length == 5 &&
	    g1.sub.length == 5 &&
	    g1.subscriptions.length == 10 &&
	    g1.subscriptions[0].publisher == "publisher0" &&
	    g1.subscriptions[9].subscriber == "subscriber4", "pass $events property and !events property" );

	hm.binding( "group1", "!event1:publisher1|handler1|option1|delegate1" );

	var g2 = new Binding( "ns:path1;group1:path2" );

	ok( g2.ns == "path1" &&
	    g2.subscriptions.length === 1 &&
	    g2.subscriptions[0].publisher == "path1.path2.publisher1" &&
	    g2.subscriptions[0].options == "option1" &&
	    g2.subscriptions[0].eventTypes == "event1" &&
	    g2.subscriptions[0].delegate == "delegate1",
		"Can watch text subscription group"
	);

	var g3 = new Binding( "group1:path2|groupOption1" );

	ok( g3.subscriptions[0].options == "groupOption1",
		"group option can overwrite the option in subscription group text" );

	hm.binding( "group2", "!event1:publisher1|handler1|_|delegate1" );

	var g4 = new Binding( "group2:path2|groupOption1" );

	ok( g4.subscriptions[0].options === undefined,
		"subscription option can explicit set to undefined by using _" );

	hm.binding( "group3", "group1:path1;!event2:publisher2|handler2|option2|delegate2" );

	var g5 = new Binding( "ns:path3;group3:path2|groupOption3" );

	ok( g5.subscriptions.length == 2,
		"a group can nested inside of another group" );

	ok( g5.subscriptions[0].publisher == "path3.path2.path1.publisher1",
		"the path is passed in to and other group, and further passed into another group," +
		"also the subscription in nested subscription group is imported first, and" +
		"the subscription in outer subscription will be imported later." );

	ok( g5.subscriptions[0].options == "groupOption3",
		"the outer options can be passed in nested subscription group, and further passed " +
		"into the subscription of nested subscription." );

	hm.binding( "group4", "!event4:publisher4|handler4|_option4|delegate4" );

	var g6 = new Binding( "group4:path4|groupOption4" );

	ok( g6.subscriptions[0].options == "option4",
		"the options in nested subscription group, can be protected using '_' prefix" );

	var temp;
	hm.binding( "codeGroup1", temp = function( elem, path, elemBinding, options ) {

		elemBinding.appendSub( elem, path, "event1", "handler1", options );

	} );

	var g7 = new Binding( "codeGroup1:path1|options1" )

	var dynamicBinding = g7.dynamicBindings[0];
	ok(dynamicBinding[0] == temp, "dynamic binding can be added");
	dynamicBinding[0](dynamicBinding[1], dynamicBinding[2], dynamicBinding[3], dynamicBinding[4]);

	ok( g7.subscriptions.length == 1 &&
	    g7.subscriptions[0].publisher == "path1" &&
	    g7.subscriptions[0].eventTypes == "event1" &&
	    g7.subscriptions[0].handler == "handler1" &&
	    g7.subscriptions[0].options == "options1",
		"we can add subscription in code group programmatically" );

	hm.binding( "codeGroup2", function( elem, path, elemBinding, options ) {
		elemBinding.prependSub( elem, path, "event2", "handler2", options );
	} );

	var g8 = new Binding( "codeGroup1:path1|options1;codeGroup2:path2|option2" );

	ok(g8.dynamicBindings.length == 2, "dynamic binding can be added");
	dynamicBinding = g8.dynamicBindings[0];
	dynamicBinding[0](dynamicBinding[1], dynamicBinding[2], dynamicBinding[3], dynamicBinding[4]);
	dynamicBinding = g8.dynamicBindings[1];
	dynamicBinding[0](dynamicBinding[1], dynamicBinding[2], dynamicBinding[3], dynamicBinding[4]);

	ok( g8.subscriptions.length == 2 &&
	    g8.subscriptions[0].publisher == "path2" &&
	    g8.subscriptions[0].eventTypes == "event2" &&
	    g8.subscriptions[0].handler == "handler2" &&
	    g8.subscriptions[0].options == "option2",
		"we can add subscription to the head in code group programmatically" );

	hm.binding( "codeGroup3", function( elem, path, elemBinding, options ) {
		elemBinding.clearSubs();
	} );

	var g9 = new Binding( "codeGroup1:path1|options1;codeGroup2:path2|option2;codeGroup3:_" );

	ok( g9.subscriptions.length == 0,
		"we can clear subscriptions using code group" );

} );

//need to add namespace test

test( "embedded function as handler", function() {

	//In subscriptions, the handler is either reusable or adhoc
	//the reusable handler normally is saved in hm.workflow(handlerName);
	//for adhoc handler, that are persisted as part of model,
	//our problem is that we need to access them in hm attribute
	var $div = $( "<div data-sub='!afterUpdate:light.color|#..handleColorChange'></div>" ).appendTo( testArea() );
	hm.set( "light", {
		color: "green",
		handleColorChange: function( e ) {
			if (e.publisher.get() == "green") {
				this.html( "go" );
			} else {
				this.html( "stop" );
			}
		}
	} );

	$div.parseSubs();
	hm.set( "light.color", "red" );
	equal( $div.html(), "stop", "can use model helper to handle event" );
	$div.remove();

	ok( true );
	assertEmptyDb();
} );


