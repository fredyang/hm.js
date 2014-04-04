//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var toTypedValue = hm.util.toTypedValue;
	var isUndefined = hm.util.isUndefined;
	var defaultOptions = hm.options;
	var bindings = hm.binding;
	//#end_merge

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

	//#merge
})
	( jQuery, hm );
//#end_merge


