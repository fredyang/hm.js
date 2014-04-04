//
/*
 <@depends>
 subscription.js,
 model.js
 </@depends>
 */
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var hmFn = hm.fn;
	var isUndefined = hm.util.isUndefined;
	var isArray = $.isArray;
	var isFunction = $.isFunction;
	//#end_merge

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


	//#merge
})( jQuery, hm );
//#end_merge
