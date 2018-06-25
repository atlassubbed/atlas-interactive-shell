# atlas-interactive-shell

Runs a shell command interactively, abstracts useful callbacks as opposed to manually listening for events.

---

## install

```
npm install --save atlas-interactive-shell
```

## why

Sometimes you need to run a command and programmatically interact with the standard input when prompted with a message. The implementation looks something like this:

```javascript
const { spawn } = require("child_process");
const child = spawn(cmd);
const onDone = (err, code) => {
  // only run this once
}
child.stdout.on("data", data => {
  // maybe write to stdin
})
child.stderr.on("data", data => {
  // maybe write to stdin or kill
})
child.on("exit", code => {
  // call onDone if we haven't already
})
child.on("close", code => {
  // call onDone if we haven't already
})
child.on("error", err => {
  // call onDone with error if we haven't already
})
```

I would rather keep a clean house and not litter my codebase with this event and stream stuff. So, I tried to come up with a decent API to abstract it away.

## examples

#### passing command and opts

The first argument is a command, the second argument is spawn opts and is entirely optional.

```javascript
const Shell = require("atlas-interactive-shell");
const cmd = "ls && mkdir -p new-dir/new-sub-dir && ls new-dir";
const opts = {cwd: __dirname, ...otherSpawnOpts};
const shell = new Shell(cmd, opts);
```

#### onDone callback

This is called only once, whether the command exits normally or with an error:

```javascript
...
shell.onDone((err, code) => {
  if (!err) console.log(code)
})
```

#### onData callback

Captures stderr and stdout, allowing you to reply with an error or a message, respectively:

```javascript
...
shell.onData((stderr, stdout, reply) => {
  if (stderr) 
    return reply(new Error("oops!")); // triggers onDone with our err
  if (stdout === "enter username:")
    return reply("atlassubbed\n");
})
```

#### logging

The spawned command will not log anything unless you call the `log` method, in which case all stderr and stdout will be piped to the parent process:

```javascript
...
shell.log()
```

#### chaining everything

All of the methods can be chained, since they just return the instance:

```javascript
...
shell.log().onDone(err => console.error(err)).onData(stderr => {
  stderr && console.log(stderr)
})
```


