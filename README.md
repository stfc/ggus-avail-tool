[1]: [https://addons.mozilla.org/en-GB/firefox/addon/cors-everywhere/]
[2]: [https://github.com/spenibus/cors-everywhere-firefox-addon]
[3]: [https://chrome.google.com/webstore/detail/moesif-origin-cors-change/digfbfaphojjndkpccljibejjbppifbc?hl=en]
[4]: [https://www.moesif.com/blog/technical/cors/Authoritative-Guide-to-CORS-Cross-Origin-Resource-Sharing-for-REST-APIs/]

# GGUS / Availability tool
Simple browser applicaiton to:
- Get open GGUS tickets.
- Get closed GGUS tickets (either last week or any timeframe).
- Get VO availabilities (either last week or any timeframe).

And then convert the generated table into a wiki format.

Can be run locally or hosted.

## Before use
Due to a CORS (Cross origin request sharing) issue,
the tool wont work properly without a specific plugin
that allows CORS requests without the usual headers from the server.

To install the plugin:

### Firefox
Install the [CORS Everywhere][1] addon.
When using the tool click the `Cors E` icon so that it's green.
Make sure to disable it everywhere else, however.

More information about the addon can be found on the GitHub repo [here][2].

### Chrome

Install the [Moesif Origin & CORS changer][3] addon.
Before using it click the icon and click the `SHOW DETAILED OPTIONS` button.
Then in the options page change the `Access-Control-Allow-Credentials:` field to `true` and click save.
Then when using the tool, similar to the Firefox addon click the addon button and set to *'Currently running...'*
Also as with with Firefox addon, remember to disable it when not using the tool.

More information about this addon can be found on their website [here][4].
