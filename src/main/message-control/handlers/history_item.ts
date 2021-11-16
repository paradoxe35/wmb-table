import { HistoryData, HistoryDataItem, HistoryDateUpload } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';

const getHistoryRefOrInsert = async (history: HistoryDateUpload) => {
  const ref = await queryDb.findOne<HistoryData>(db.history, {
    date: history.date,
  });
  if (ref) return ref;
  const histories = await queryDb.find<HistoryData>(
    db.history,
    {},
    {},
    {
      milliseconds: -1,
    }
  );
  if (histories.length >= 30) {
    const id = histories[histories.length - 1]._id;
    await queryDb.remove(db.history, {
      _id: id,
    });
    await queryDb.remove(
      db.history,
      {
        historyId: id,
      },
      { multi: true }
    );
  }

  return await queryDb.insert<HistoryData>(db.history, {
    date: history.date,
    milliseconds: history.milliseconds,
  });
};

const historyItemStore = async (
  historyRef: HistoryData,
  history: HistoryDateUpload
) => {
  await queryDb.remove(db.historyItem, {
    date: history.date,
    documentTitle: history.documentTitle,
  });
  const historyItems = await queryDb.find<HistoryDataItem>(db.historyItem);
  if (historyItems.length >= 50) {
    await queryDb.remove(db.historyItem, {
      _id: historyItems[historyItems.length - 1]._id,
    });
  }

  return await queryDb.insert<HistoryDataItem>(db.historyItem, {
    historyId: historyRef._id,
    date: history.date,
    time: history.time,
    documentTitle: history.documentTitle,
  });
};

export default async (_: any, history: HistoryDateUpload | undefined) => {
  if (history) {
    const historyRef = await getHistoryRefOrInsert(history);
    await historyItemStore(historyRef, history);
  }

  return (await queryDb.find<HistoryData>(db.history)).sort(
    (a, b) => b.milliseconds - a.milliseconds
  );
};

export async function history_data_item(_: any, history: HistoryData) {
  const items = await queryDb.find<HistoryDataItem>(db.historyItem, {
    historyId: history._id,
  });

  return items.sort((a, b) => b.time.localeCompare(a.time));
}
