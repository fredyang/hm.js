(function() {

	var table = {};
	var mapper = {
		POST: "create",
		GET: "get",
		PUT: "update",
		DELETE: "remove"
	};

	var guid = 1;
	var url = "http://localhost:3002/people";
	var rUrl = RegExp( url + "(/(\\d+))?" );

	$.ajaxMock.url( rUrl, function( data, ajaxOriginalOptions ) {
		var id = rUrl.exec( ajaxOriginalOptions.url )[2];
		var method = mapper[ajaxOriginalOptions.type];
		return app[method]( id, data );
	} );

	var app = {

		get: function( id ) {
			if (id !== undefined) {
				return table[id];
			} else {
				var rtn = [];
				for (var key in table) {
					rtn.push( table[key] );
				}
				return rtn;
			}
		},
		create: function( id, entity ) {
			id = guid++;
			entity.id = id;
			table[id] = entity;
			return {
				id: id
			};
		},
		update: function( id, entity ) {
			if (table[id] !== undefined) {
				table[id] = entity;
			}
		},

		remove: function( id ) {
			delete table[id];
		}
	};


})();
