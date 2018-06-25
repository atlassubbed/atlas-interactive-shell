#!/usr/bin/env node
process.stdout.write("hello")
process.stdin.on("data", data => {
  process.exit()
})