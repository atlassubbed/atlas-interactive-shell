const { describe, it } = require("mocha")
const { expect } = require("chai")
const { join } = require("path")
const rewire = require("rewire")
const Shell = rewire("../src/shell")
const { capture, restore } = require("./helpers");

capture(process)

let revert;
const streams = ["stderr", "stdout"], r = join(__dirname, "assets");

describe("interactive shell", function(){

  beforeEach(function(){
    restore(process)
    revert && revert();
  })

  describe("is instantiated with a command string and/or spawn options", function(){

    it("should throw if the command string is invalid", function(){
      const invalidCmds = [
        undefined, null, new Date(), 22/7, 3, true, "   \n \t ", /pi/, {}, () => {}
      ]
      invalidCmds.forEach(cmd => {
        expect(() => new Shell(cmd)).to.throw("cmd must be str")
      })
    })
    it("should not throw if the command is a string (not necessarily valid command)", function(){
      expect(() => new Shell("full str")).to.not.throw()
    })
    it("should throw if the spawn opts is not a proper object", function(){
      const invalidOpts = [
        null, new Date(), 22/7, 3, true, "   \n \t ", /pi/, "pie", () => {}
      ]
      invalidOpts.forEach(opt => {
        expect(() => new Shell("pie", opt)).to.throw("opts must be obj")
      })
    })
    it("should not throw if opts is a proper object or undefined", function(){
      expect(() => new Shell("full str", {someOpts: true})).to.not.throw()
      expect(() => new Shell("full str", undefined)).to.not.throw()
    })
    it("should allow spawn options to be passed as-is to the spawn call", function(){
      const env = Object.assign({},process.env);
      env.rand = Math.random();
      const opts = {env}
      let spawnOpts;
      revert = Shell.__set__("spawn", (cmd, inputOpts) => {
        spawnOpts = inputOpts;
        return "child process"
      })
      new Shell(join(r, "command"), opts);
      expect(spawnOpts).to.equal(opts)
    })
  })

  describe("has an onData method to capture output from the command", function(){
    it("should throw if not passed a callback", function(){
      const invalidCbs = [
        undefined, null, new Date(), 22/7, 3, true, "   \n \t ", /pi/, {}
      ]
      const shell = new Shell("command")
      invalidCbs.forEach(cb => {
        expect(() => shell.onData(cb)).to.throw("onData cb must be fn")
      })
    })
    it("should return the instance to allow for chaining methods", function(){
      const shell = new Shell("command");
      expect(shell).to.equal(shell.onData(() => {}))
    })

    streams.forEach((stream,i) => {
      describe(`captures ${stream}`, function(){
        it(`should pass ${stream} to the the callback's argument number ${i+1}`, function(done){
          new Shell("node " + join(r, `${stream}.js`)).onData((...args) => {
            expect(args[i]).to.equal(`wrote to ${stream}`)
            done()
          })
        })

        it(`should not pass ${streams[i ? 0 : 1]} to the the callback when capturing ${stream}`, function(done){
          new Shell("node " + join(r, `${stream}.js`)).onData((...args) => {
            expect(args[i ? 0 : 1]).to.be.undefined
            done()
          })
        })
      })
    })

    describe("can reply to stdout", function(done){
      it("should pass a reply function to the callback's third argument", function(done){
        new Shell("node " + join(r, "stdout.js")).onData((err, out, reply) => {
          expect(reply).to.be.a("function");
          done();
        })
      })
      it("should write to standard input if a message reply is sent", function(done){
        const shell = new Shell("node " + join(r, "stdin.js"));
        let passedData;
        const write = shell.child.stdin.write.bind(shell.child.stdin);
        shell.child.stdin.write = (...args) => {
          expect(args[0]).to.equal("hi\n")
          write(...args)
          done()
        }
        shell.onData((err, out, reply) => {
          reply("hi\n")
        })
      })
    })

    describe("can kill with error on stderr", function(){
      it("should pass a reply function to the callback's third argument", function(done){
        new Shell("node " + join(r, "stderr.js")).onData((err, out, reply) => {
          expect(reply).to.be.a("function");
          done();
        })
      })
      it("should kill on a reply and emit the error", function(done){
        const shell = new Shell("node " + join(r, "stderr.js"));
        let calledKill = false, emitted = false;
        shell.child.kill = () => {
          calledKill = true
        }
        shell.child.emit = (...args) => {
          if (args[0] === "error"){
            expect(emitted).to.be.false;
            emitted = true;
            expect(calledKill).to.be.true;
            expect(args[1]).to.be.an("error")
            expect(args[1].message).to.equal("this is an error")
            done();
          } else {
            emitted = true;
          }
        }
        shell.onData((err, out, reply) => {
          reply(new Error("this is an error"))
        })
      })
    })
  })

  describe("has an onDone method to capture the end of the command", function(){
    it("should throw if not passed a callback", function(){
      const invalidCbs = [
        undefined, null, new Date(), 22/7, 3, true, "   \n \t ", /pi/, {}
      ]
      const shell = new Shell("command")
      invalidCbs.forEach(cb => {
        expect(() => shell.onDone(cb)).to.throw("onDone cb must be fn")
      })
    })
    it("should return the instance to allow for chaining methods", function(){
      const shell = new Shell("command");
      expect(shell).to.equal(shell.onDone(() => {}))
    })
    it("should only ever be called once when the command is done", function(done){
      new Shell("node " + join(r, "stdout.js")).onDone(() => done())
    })
    it("should only ever be called once when the command errors out", function(done){
      new Shell("node " + join(r, "dne.js")).onData((err, res, reply) => {
        reply(new Error(err))
      }).onDone(err => {
        expect(err).to.be.an("error");
        expect(err.message).to.contain("Cannot find module")
        done()
      })
    })
    it("should supply an exit code as the callback's second argument", function(done){
      new Shell("node " + join(r, "stdout.js")).onDone((err, code) => {
        expect(err).to.be.null;
        expect(code).to.equal(0)
        done()
      })
    })
  })

  describe("has a log method to allow piping to the parent process", function(){
    it("should return the instance to allow for chaining methods", function(){
      const shell = new Shell("command");
      expect(shell).to.equal(shell.log())
    })
    streams.forEach(stream => {
      it(`should attempt to pipe its ${stream} to process.${stream} if log is called`, function(){
        const shell = new Shell("command");
        let pipedStream;
        shell.child[stream].pipe = inputStream => {
          pipedStream = inputStream;
        }
        shell.log();
        expect(pipedStream).to.equal(process[stream])
      })
      it(`should not attempt to pipe its ${stream} to process.${stream} if log is not called`, function(){
        const shell = new Shell("command");
        let pipedStream;
        shell.child[stream].pipe = inputStream => {
          pipedStream = inputStream;
        }
        expect(pipedStream).to.be.undefined
      })
      it(`should pipe its ${stream} to process.${stream} if log is called`, function(done){
        let passedData;
        process[stream].write = data => {
          passedData = data.toString()
        }
        const shell = new Shell("node " + join(r, `${stream}.js`)).log()
        shell.onDone(() => {
          expect(passedData).to.equal(`wrote to ${stream}`)
          restore(process), done()
        })
      })
      it(`should not pipe its ${stream} to process.${stream} if log is not called`, function(done){
        let passedData;
        process[stream].write = data => {
          passedData = data.toString()
        }
        const shell = new Shell("node " + join(r, `${stream}.js`))
        shell.onDone(() => {
          expect(passedData).to.be.undefined
          restore(process), done()
        })
      })
    })
  })
})
