const fs = require('fs')
const process = require('child_process')
// const cmd = 'npm version patch --no-git-tag-version';
const cmd = 'npm version minor --no-git-tag-version';
// const cmd = 'npm version major --no-git-tag-version';
process.execSync(cmd)
process.execSync('cd ./script && ' + cmd)
fs.rm('./bundle', {recursive: true}, function () {
    fs.mkdirSync('./bundle')
    fs.cpSync('./esm', './bundle', {recursive: true})
    // fs.cpSync('./lib', './bundle', {recursive: true})
    fs.cpSync('./script/package.json', './bundle/package.json')
    fs.rmSync('./esm', {recursive: true})
    fs.rmSync('./lib', {recursive: true})
})

