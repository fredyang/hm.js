//#debug
//
//<@depends>subscription.js, model.js, declarative.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var isString = hm.util.isString;
	var isObject = hm.util.isObject;
	var isUndefined = hm.util.isUndefined;
	var isFunction = $.isFunction;
	var util = hm.util;
	var Binding = hm.Binding;
	//#end_merge

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

	//#merge
})
	( jQuery, hm );
//#end_merge
//#end_debug