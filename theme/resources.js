var rs = require('http/v3/rs');
var uuid = require('utils/v3/uuid');
var escape = require('utils/v3/escape');
var streams = require('io/v3/streams');
var repositoryManager = require('repository/v3/manager');
var configurations = require('core/v3/configurations');
var themesManager = require('theme/extensions/themes');

var PATH_REGISTRY_PUBLIC = '/registry/public';
var DIRIGIBLE_THEME_DEFAULT = 'DIRIGIBLE_THEME_DEFAULT';
var DEFAULT_THEME = 'default';
var NAME_PARAM = 'name';
var THEME_COOKIE = 'dirigible-theme';
var THEMES_PATH = '/resources/themes/';
var THEME_CACHE = 'THEME_CACHE';

rs.service()
	.resource('')
		.get(function(ctx, request, response) {
			var theme = getCurrentTheme(request, response);
			response.print(theme);
			response.setContentType('text/plain');
		})
	.resource('{path}')
		.get(function(ctx, request, response) {
			var path = ctx.pathParameters.path;

			var cacheETag = configurations.get(THEME_CACHE + '_' + path);
			var ifNoneMatchHeader = request.getHeader('If-None-Match');

			if (ifNoneMatchHeader !== null && cacheETag !== null && ifNoneMatchHeader === cacheETag) {
				response.setHeader('ETag', cacheETag);
				response.setStatus(response.NOT_MODIFIED);
			} else {
				var content = getContent(request, response, path);

				if (content !== null && content !== '') {
					var etag = uuid.random();
					configurations.set(THEME_CACHE + '_' + path, etag);

					response.setStatus(response.OK);
					response.setHeader('ETag', etag);
					response.setHeader('Cache-Control', 'public, must-revalidate, max-age=0');
					response.println(content);
				} else {
					response.setStatus(response.NOT_FOUND);
					response.println('');
				}
			}
		})
.execute();

function getContent(request, response, path) {
	var content = null;
	var cookieValue = getCurrentTheme(request, response);
	var themes = themesManager.getThemes();

	var themeModule = null;
	for (var i = 0; i < themes.length; i ++) {
		if (themes[i].id === cookieValue) {
			themeModule = themes[i].module;
			break;
		}
	}

	if (themeModule !== null && themeModule !== '') {
		var resource = repositoryManager.getResource(PATH_REGISTRY_PUBLIC + '/' + themeModule + '/' + path);
	
		if (resource.exists()) {
			var resourceContent = resource.getContent();
			var repositoryInputStream = streams.createByteArrayInputStream(JSON.parse(resourceContent));
			content = repositoryInputStream.readText();
		} else {
			var inputStream = streams.getResourceAsByteArrayInputStream(themeModule + '/' + path);
			content = inputStream.readText();
		}
	}
	return content;
}

function getCurrentTheme(request, response) {
	var env = configurations.get(DIRIGIBLE_THEME_DEFAULT);
	var cookieValue = env === null ? DEFAULT_THEME : env;
	var themeName = request.getParameter(NAME_PARAM);
	themeName = escape.escapeHtml4(themeName);
	themeName = escape.escapeJavascript(themeName);

	if (themeName !== null && themeName !==  '') {
		setThemeCookie(response, themeName);
		resetThemeCache();
		cookieValue = themeName;
	} else {
		var themeCookie = getThemeCookie(request);
		cookieValue = themeCookie !== null ? themeCookie : cookieValue;
	}

	cookieValue = escape.escapeHtml4(cookieValue);
	cookieValue = escape.escapeJavascript(cookieValue);
	return cookieValue;
}

function getThemeCookie(request) {
	var cookies = request.getCookies();
	for (var i = 0; i < cookies.length; i ++) {
		if (cookies[i].name === THEME_COOKIE) {
			return cookies[i].value;
		}
	}
	return null;
}

function setThemeCookie(response, theme) {
	response.addCookie({
		'name': THEME_COOKIE,
		'value': theme,
		'path': '/',
		'maxAge': 30 * 24 * 60 * 60
	});
}

function resetThemeCache() {
	var configurationKeys = JSON.parse(configurations.getKeys());
	for (var i = 0; i < configurationKeys.length; i ++) {
		var key = configurationKeys[i];
		if (key.startsWith(THEME_CACHE)) {
			configurations.set(key, '');
		}
	}
}