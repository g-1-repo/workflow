// Temporary file to test lint error handling
const unusedVar = 'this will cause a lint error'
function badSpacing() {
  console.log('test')
  return unusedVar
}
