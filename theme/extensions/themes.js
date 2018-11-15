/*
 * Copyright (c) 2017 SAP and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 * Contributors:
 * SAP - initial API and implementation
 */

var extensions = require('core/v3/extensions');

exports.getThemes = function() {
	var themes = [];
	var themeExtensions = extensions.getExtensions('ide-themes');
	console.error('themeExtensions: ' + JSON.stringify(themeExtensions));
	for (var i = 0; themeExtensions  !== null && i < themeExtensions .length; i++) {
	    var themeExtension = require(themeExtensions[i]);
	    var theme = themeExtension.getTheme();
	    themes.push(theme);
	}
	
	return themes;
};