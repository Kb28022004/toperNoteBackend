const fs = require("fs");
const path = require("path");
const { fromPath } = require("pdf2pic");

exports.convertPdfToImages = async (pdfPath, outputDir, baseName) => {
  try {
    const options = {
      density: 100,
      saveFilename: baseName,
      savePath: outputDir,
      format: "png",
      width: 600,
      height: 800,
    };

    const convert = fromPath(pdfPath, options);

    // Convert only the first 5 pages to save resources/time (as per user requirement "2-3 pages" for students, but admin needs all - let's try to convert all or a reasonable limit like 10)
    // Actually user says "admin can see all...". So we should convert all pages.
    // pdf2pic convert(n) converts page n. bulk(-1) converts all.
    
    // Note: bulk(-1) might be slow for large PDFs. But simpler implementation.
    const result = await convert.bulk(-1, { responseType: "image" });
    
    console.log("PDF conversion result:", result.length, "pages");

    return fs
      .readdirSync(outputDir)
      .filter((file) => file.startsWith(baseName) && file.endsWith(".png"))
      .sort((a, b) => {
          // Sort numerically if possible to ensure page order
          // pdf2pic usually appends .1.png, .2.png etc.
          // let's just use string sort for now or improved sort
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

  } catch (err) {
    console.error("PDF2PIC ERROR:", err);
    return [];
  }
};
