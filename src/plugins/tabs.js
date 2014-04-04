//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//

//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var defaultOptions = hm.options;
	var bindings = hm.binding;
	//#end_merge

	defaultOptions.selectedClass = "selected";
	defaultOptions.tabViewAttr = "tab-view";
	defaultOptions.tabLinkAttr = "tab-link";
	defaultOptions.tabContainerNameAttr = "tab-container-name";

	hm.workflow( {

		//a tab can be tabView or tabLink
		selectTab: function( e ) {
			var tabId = this.attr( defaultOptions.tabViewAttr ) || this.attr( defaultOptions.tabLinkAttr ),
				selectedClass = e.handler.options;

			if (e.publisher.get() == tabId) {
				this.addClass( selectedClass );
			} else {
				this.removeClass( selectedClass );
			}
		},

		//a tab can be tabView or tabLink
		selectTabInContainer: function( e ) {
			var selectedTabId = e.publisher.get(),
				tabViewAttr = defaultOptions.tabViewAttr,
				tabLinkAttr = defaultOptions.tabLinkAttr,
				options = e.handler.options,
				tabLinkAndTabViewSelector = options.selector,
				selectedClass = options.selectedClass;

			this.find( tabLinkAndTabViewSelector ).andSelf().each( function( index, elem ) {
				var $elem = $( elem ),
					tabId = $elem.attr( tabViewAttr ) || $elem.attr( tabLinkAttr );

				if (tabId == selectedTabId) {
					$elem.addClass( selectedClass );
				} else {
					$elem.removeClass( selectedClass );
				}
			} );
		}
	} );

	function handleTabLinkClick( e ) {
		//this is the subscriber, which is the model
		//e.handler.options is the tab id
		this.set( e.publisher.attr( e.handler.options ) );
		e.preventDefault();
		e.stopPropagation();

	}

	//a tab can be tabView or tabLink
	//for tabLink use <li tab-link="news" tab="category">News</li>
	//if your selected class is not "selected" but "active" use
	// <li tab-link="news" tab="category|active">News</li>
	//
	//for tabView use <div tab-view="news" tab="category">contents</div>
	//or <div tab-view="news" tab="category|active">contents</div>
	bindings( {

		tab: function( elem, path, binding, selectedClass ) {

			selectedClass = selectedClass || defaultOptions.selectedClass;

			binding.appendSub( elem, path, "init afterUpdate", "*selectTab", selectedClass );

			if ($( elem ).attr( defaultOptions.tabLinkAttr )) {
				binding.appendSub( path, elem, "click", handleTabLinkClick, defaultOptions.tabLinkAttr );
			}

		},

		//a tabContainer can hold tabLink or tabView
		//it can be
		//
		//<ul tab-container="category">
		//	<li tab-link="news">News</li>
		//	<li tab-link="opinion">Opinion</li>
		//	<li tab-link="sports">Sports</li>
		//</ul>
		//
		//<div class="tabs" tab-container="category">
		//	<div tab-view="news">content</div>
		//	<div tab-view="opinion">content</div>
		//</div>
		//options usage
		//tab-container="category|containerName,selectedClass"
		//if you have tab container nested within another tab container
		//you can use container name to specify which container it is in
		tabContainer: function( elem, path, context, options ) {

			options = options || "";
			options = options.split( "," );

			var tabViewAttr = defaultOptions.tabViewAttr,
				tabLinkAttr = defaultOptions.tabLinkAttr,
				tabContainerNameAttr = defaultOptions.tabContainerNameAttr,
				containerName = options[0],
				selectedClass = options[1],

				tabContainerSelector = containerName ?
					"[" + tabContainerNameAttr + "='" + containerName + "']" //with explicit tab container name
					: "", //no tab container name

				tabLinkSelector = "[" + tabLinkAttr + "]" + tabContainerSelector,

				tabLinkAndTabViewSelector = tabLinkSelector + ",[" + tabViewAttr + "]" + tabContainerSelector;

			//update the tab model with the tabLink when click
			context.appendSub( path, elem, "click", handleTabLinkClick, tabLinkAttr, tabLinkSelector /*delegateSelector*/ );

			//
			//highlight the tab when the model change
			context.appendSub( elem, path, "init100 afterUpdate", "*selectTabInContainer", {
				selector: tabLinkAndTabViewSelector,
				selectedClass: selectedClass || defaultOptions.selectedClass
			} );
		}
	} );

	//#merge
})( jQuery, hm );
//#end_merge