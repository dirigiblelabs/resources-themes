var rs = require('http/v3/rs');
var uuid = require('utils/v3/uuid');
var escape = require('utils/v3/escape');
var streams = require('io/v3/streams');
var repositoryManager = require('repository/v3/manager');
var configurations = require('core/v3/configurations');

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
			var cookieValue = getCurrentTheme(request, response);

			var cacheValue = configurations.get(THEME_CACHE + '_' + path);
			var etag = null;
			var ifNoneMatchHeader = request.getHeader('If-None-Match');

			if (ifNoneMatchHeader !== null && cacheValue !== null && ifNoneMatchHeader === cacheValue) {
				response.setHeader('ETag', cacheValue);
				response.setStatus(response.NOT_MODIFIED);
			} else {
				var repositoryPath = PATH_REGISTRY_PUBLIC + THEMES_PATH + cookieValue + '/' + path;
				var resource = repositoryManager.getResource(repositoryPath);
				var content = null;

				if (resource.exists()) {
					var resourceContent = resource.getContent();
					var repositoryInputStream = streams.createByteArrayInputStream(JSON.parse(resourceContent));
					content = repositoryInputStream.readText();
				} else {
					var inputStream = streams.getResourceAsByteArrayInputStream(THEMES_PATH + cookieValue + '/' + path);
					content = inputStream.readText();
				}

				etag = uuid.random();
				configurations.set(THEME_CACHE + '_' + path, etag);

				response.setHeader('ETag', etag);
				response.setHeader('Cache-Control', 'public, must-revalidate, max-age=0');
				response.println(content);
			}
		})
.execute();

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