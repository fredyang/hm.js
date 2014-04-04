//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var newTemplateHandler = hm.template.newTemplateHandler;
	var rDigit = /^\d+$/;
	var hmFn = hm.fn;
	var isObject = hm.util.isObject;
	var bindings = hm.binding;
	//#end_merge

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

	//#merge
})
	( jQuery, hm );
//#end_merge


