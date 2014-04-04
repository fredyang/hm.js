#!/bin/bash
src_dir=src
plugins_dir=src/plugins
build_dir=build
prefix=.
dist_dir=${prefix}/dist
version=$(cat version.txt)
date=$(git log -1 --pretty=format:%ad)

core_files="$src_dir/model.js
			$src_dir/subscription.js
			$src_dir/declarative.js
			$src_dir/declarative.debug.js
			$src_dir/loader.js
			$src_dir/template.js
			$src_dir/template-engines/template-engine-jsrender.js
			$src_dir/template-engines/template-engine-handlebars.js
			$src_dir/valueAdapter.js
			$src_dir/basic-subscriptions.js"

plugin_files="$plugins_dir/entity.js
			  $plugins_dir/validation.js
			  $plugins_dir/listView-queryView.js
			  $plugins_dir/table.js
			  $plugins_dir/shadowEdit.js
			  $plugins_dir/routing.js
			  $plugins_dir/tabs.js
			  $plugins_dir/App.js"



mkdir -p $dist_dir
# rm $dist_dir/*

function make () {
	makeRelease $1
	makeDebug $1
}

function makeRelease () {
	if [ $1 ]; then
		output_mini="$dist_dir/hm.$1.min.js"
		out_normal="${dist_dir}/hm.$1.js"
		src_files="$core_files
		   $src_dir/outro.txt"
	else
		src_files="$core_files
		   $plugin_files
		   $src_dir/outro.txt"
		output_mini="$dist_dir/hm.min.js"
		out_normal="${dist_dir}/hm.js"
	fi


	cat $src_files | sed -e '/\/\/#merge/,/\/\/#end_merge/d' -e '/\/\/#debug/,/\/\/#end_debug/d' > $out_normal.tmp
	echo merging source file to $out_normal
	cat $src_dir/license.txt $out_normal.tmp | sed -e "s/@version/$version/" -e "s/@date/$date/" > $out_normal
	echo minifying source file to  $output_mini using closure compiler
	java -jar $build_dir/compiler.jar  --js $out_normal.tmp  --js_output_file $output_mini.tmp
	cat $src_dir/license-min.txt $output_mini.tmp | sed -e "s/@version/${version}/" -e "s/@date/${date}/" > $output_mini
	rm -f ${output_mini}.tmp $out_normal.tmp
	echo jshint $out_normal
	jshint $out_normal
}

function makeDebug () {
	if [ $1 ]; then
		output_debug="$dist_dir/hm.$1.debug.js"
	else 
		output_debug="$dist_dir/hm.debug.js"
	fi

	cat ${src_files} | sed -e '/\/\/#merge/,/\/\/#end_merge/d' > ${output_debug}.tmp;
	echo merging debug source file to ${output_debug}
	cat ${src_dir}/license.txt ${output_debug}.tmp | \
    	                    sed "s/@version/${version}/" | \
    						sed "s/@date/${date}/" > ${output_debug}
	rm -f ${output_debug}.tmp

}


if [ "$1" == "core" ]; then
	echo $1
	make "core"
elif [ "$1" == "full" ]; then
	make 
	jshint $out_normal
elif [ "$1" == "clean" ]; then
	echo "Removing Distribution directory:" $dist_dir
	rm -rf $dist_dir
else
	make "core"
	make
fi



