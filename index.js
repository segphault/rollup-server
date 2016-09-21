const rollup = require("rollup");
const watch = require("rollup-watch");

const client = `
function onRollupUpdate(callback) {
  var script = null;

  var es = new EventSource("/rollup/events");
  es.onmessage = event => {
    if (script) script.remove();

    script = document.createElement("script");
    script.type = "application/javascript";
    script.text = JSON.parse(event.data).code;

    document.body.appendChild(script);
    callback();
  }
}
`;

module.exports = config => {
  let current = {code: "", map: ""};
  let clients = [];

  function ongenerate(bundle, output) {
    current = output;
    for (let res of clients)
      res.write(`data: ${JSON.stringify({code: output.code})}\n\n`);
  }

  let settings = Object.assign({}, config,
    {plugins: [...config.plugins, {ongenerate}]});

  watch(rollup, settings).on("event", data => {
    if (data.error)
      console.error(data.error.toString(), data.error.codeFrame || "");
  });

  return (req, res, next) => {
    if (req.url === "/rollup/bundle.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("X-SourceMap", "/rollup/bundle.js.map");
      return res.end(current.code + client);
    }

    if (req.url === "/rollup/bundle.js.map")
      return res.end(current.map.toString())

    if (req.url === "/rollup/events") {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.write("event: update\n\n");

      clients.push(res);
      req.connection.on("close", () => clients.splice(clients.indexOf(res), 1));
    }

    return next ? next() : null;
  };
};
