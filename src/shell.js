const { isFullStr, isObj, isFn } = require("./util")
const { spawn } = require("child_process")

module.exports = class Shell {
  constructor(cmd, opts={}){
    if (!isFullStr(cmd)) throw new Error("cmd must be str");
    if (!isObj(opts)) throw new Error("opts must be obj");
    opts = Object.assign(opts, {shell: true})
    this.child = spawn(cmd, opts)
  }
  onData(cb){
    if (!isFn(cb)) throw new Error("onData cb must be fn");
    const c = this.child;
    c.stderr.on("data", d => cb(d.toString(), undefined, err => {
      if (err) c.kill(), c.emit("error", err);
    }))
    c.stdout.on("data", d => cb(undefined, d.toString(), res => {
      if (res) c.stdin.write(res);
    }))
    return this;
  }
  onDone(cb){
    if (!isFn(cb)) throw new Error("onDone cb must be fn");
    let fin = 0, c = this.child;
    c.on("error", err => !(fin++) && cb(err))
    c.on("close", code => !(fin++) && cb(null, code))
    c.on("exit", code => !(fin++) && cb(null, code))
    return this;
  }
  log(){
    const c = this.child;
    ["stdout", "stderr"].forEach(s => c[s].pipe(process[s]));
    return this;
  }
}
