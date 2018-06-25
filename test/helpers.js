const streams = {"stdout": null, "stderr": null, "stdin": null}

const capture = p => Object.keys(streams).forEach(s => {streams[s] = p[s].write});

const restore = p => Object.keys(streams).forEach(s => p[s].write = streams[s])

module.exports = { capture, restore }
