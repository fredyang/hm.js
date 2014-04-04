module( "table.js" );

test( "test", function() {

	var array = [];

	var arrayNode = hm("array", array);

	ok(array.table, "when list is created, a hash table is created");

	arrayNode.push(1);
	ok(array.table[0] == array[0] && array[0] == 1, "node.push also create an entry in list.object");

	arrayNode.update(0, 2);
	ok(array.table[0] == array[0] && array[0] == 2, "node.update(index, value) synchronize list.object");

	arrayNode.del(0);
	ok(!array.table[0] && !array[0], "node.del(index) synchronize list.object");

	assertEmptyDb();

} );