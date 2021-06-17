exports.load = function (pdf2htmlex: {
  add_options: (arg0: string[]) => void;
}) {
  pdf2htmlex.add_options([
    '--zoom 1.93',
    '--font-format woff',
    '--embed-javascript 0',
  ]);
  return pdf2htmlex;
};
