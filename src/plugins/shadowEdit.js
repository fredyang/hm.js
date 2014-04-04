//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var rootNode = hm();
	var util = hm.util;
	var isUndefined = util.isUndefined;
	var clone = util.clone;
	var isFunction = $.isFunction;
	var newTemplateHandler = hm.template.newTemplateHandler;
	var extend = $.extend;
	var clearObj = util.clearObj;
	var toLogicalPath = util.toLogicalPath;
	var hmFn = hm.fn;
	var isPrimitive = util.isPrimitive;
	var isObject = util.isObject;
	var shadowRoot = hm.get( "*" );
	var bindings = hm.binding;
	//#end_merge

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

	//#merge
})( jQuery, hm );
//#end_merge
