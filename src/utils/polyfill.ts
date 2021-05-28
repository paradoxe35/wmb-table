//@ts-nocheck

Array.prototype.paginate = function <T>(
  pageNumber: number,
  itemsPerPage: number
): { data: T[]; end: boolean } {
  pageNumber = Number(pageNumber);
  itemsPerPage = Number(itemsPerPage);
  pageNumber = pageNumber < 1 || isNaN(pageNumber) ? 1 : pageNumber;
  itemsPerPage = itemsPerPage < 1 || isNaN(itemsPerPage) ? 1 : itemsPerPage;

  var start = (pageNumber - 1) * itemsPerPage;
  var end = start + itemsPerPage;
  var loopCount = 0;
  var result = {
    data: [],
    end: false,
  };

  for (loopCount = start; loopCount < end; loopCount++) {
    this[loopCount] && result.data.push(this[loopCount]);
  }

  if (loopCount == this.length) {
    result.end = true;
  }

  return result;
};
