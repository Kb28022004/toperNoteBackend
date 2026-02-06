const fs = require("fs");
const pdf = require("pdf-poppler");

exports.convertPdfToImages = async (pdfPath, outputDir, baseName) => {
  const options = {
    format: "png",
    out_dir: outputDir,
    out_prefix: baseName,
    page: null,
  };

  await pdf.convert(pdfPath, options);

  return fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith(baseName))
    .sort();
};
