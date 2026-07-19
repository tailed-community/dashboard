// Type shim for the deep import used in src/lib/resume-parser.ts.
//
// We import `pdf-parse/lib/pdf-parse.js` directly (instead of the package
// index) because the index runs a debug file-read on import that throws in
// some environments. `@types/pdf-parse` only declares the package root, so
// re-export its types for the deep path here.
declare module "pdf-parse/lib/pdf-parse.js" {
    import pdfParse = require("pdf-parse");
    export = pdfParse;
}
