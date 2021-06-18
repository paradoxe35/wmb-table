import { HistoryData, HistoryDataItem, HistoryDateUpload } from '../../types';
import db, { queryDb } from '../../utils/main/db';

const getHistoryRef = async (history: HistoryDateUpload) => {
  const ref = await queryDb.findOne<HistoryData>(db.history, {
    date: history.date,
  });
  if (ref) return ref;
  const histories = (await queryDb.find<HistoryData>(db.history)).reverse();
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

  return await queryDb.insert<HistoryData>(db.history, { date: history.date });
};

const historyItemStore = async (
  historyRef: HistoryData,
  history: HistoryDateUpload
) => {
  await queryDb.remove(db.historyItem, {
    date: history.date,
    documentTitle: history.documentTitle,
  });
  const historyItems = (
    await queryDb.find<HistoryDataItem>(db.historyItem)
  ).reverse();
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
    const historyRef = await getHistoryRef(history);
    await historyItemStore(historyRef, history);
  }

  return (await queryDb.find<HistoryData>(db.history))
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));
};

export async function history_data_item(_: any, history: HistoryData) {
  const items = await queryDb.find<HistoryDataItem>(db.historyItem, {
    historyId: history._id,
  });

  return items.sort((a, b) => b.time.localeCompare(a.time));
}
