import plexProxyHandler from './proxy';

const widget = {
	api: '{url}{endpoint}',
	proxyHandler: plexProxyHandler,

	mappings: {
		unified: {
			endpoint: '/',
		},
	},
};

export default widget;
