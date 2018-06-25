const isFullStr = str => typeof str === "string" && str.trim()
const isObj = obj => obj && typeof obj === "object" && toString.call(obj) === "[object Object]"
const isFn = fn => fn && typeof fn === "function";

module.exports = { isFullStr, isObj, isFn }