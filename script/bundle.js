const fs = require('fs')
const process = require('child_process')
process.execSync('npm version patch')
// process.execSync('npm version minor')
// process.execSync('npm version major')
process.execSync('cd ./script && npm version patch')
fs.rm('./bundle', {recursive: true}, function () {
    fs.mkdirSync('./bundle')
    fs.cpSync('./esm', './bundle', {recursive: true})
    // fs.cpSync('./lib', './bundle', {recursive: true})
    fs.cpSync('./script/package.json', './bundle/package.json')
})

