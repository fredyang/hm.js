==================================================
**hm.js** is a lightweight JavaScript library for building trivial widget or complex
Single Page Application. It gives control back to model and view, by implementing <a
href="http://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern">publish-subscribe
pattern</a>, and provides an environment where model and view can live in
harmony. Here are some of its features.


1. Lightweight client-side model with rich event features such as propagation, and cascading.
2. Unified subscription for both view and model
3. Subscription can be registered declaratively, programmatically, or mixed.
4. Reusable, functional, asynchronous event handler implemented by workflow and	activity.
5. Bundled with lots of reusable, composable workflow types, activities, and subscriptions.

For more information, please go to http://code.semanticsworks.com/hm.js/


Download
---------------------------
You can [download hm.js](https://github.com/fredyang/Hm.js/tree/master/download) from Github.

How to build your own Hm.js
----------------------------

First, clone a copy of the hm.js by running `git clone git@github.com:fredyang/hm.js.git`.
The build also depends on :

1. <a href="http://nodejs.org/">node.js</a>
2. jshint (type "npm install -g jshint" to install it)

 Then, type 'm', it will generate output in download/ folder,
To remove all build files, type 'm clean'


Questions?
----------
Please log your issue at https://github.com/fredyang/hm.js/issues