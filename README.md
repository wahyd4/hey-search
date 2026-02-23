# Hey Search

This is another [meta search](https://en.wikipedia.org/wiki/Metasearch_engine) engine web app.

# Features

- Support search via rest API, publish api page via  https://github.com/Redocly/redoc
- Support searching web, images
- support auto completes when user trying in search input
- Robust error handling when upstream engines failed, it should remind user via UI when upstream search engines fails.
- Proper retry mechanism to retry upstream search engines.
- Support managing search engines, enable or disable via UI, it should support brave, duckduckgo, google, bing
- Best responsive and simple UI, A modern web UI support both desktop and mobile browsers, but put mobile first
- frontend part to use shadcn and react js, and make a Docker image for it. Backend write in Python
- Good UI to render image search results page.
