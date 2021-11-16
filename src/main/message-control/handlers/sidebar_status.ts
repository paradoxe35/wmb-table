import { SidebarStatus } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';

export default async (_: any) => {
  const status = await queryDb.findOne<SidebarStatus>(db.sidebarStatus);
  if (!status) {
    await queryDb.insert<SidebarStatus>(db.sidebarStatus, { hidden: false });
  }
  return await queryDb.findOne<SidebarStatus>(
    db.sidebarStatus,
    {},
    {},
    { createdAt: -1 }
  );
};

export async function sidebar_status_set(_: any, _id: string, hidden: boolean) {
  await queryDb.update(db.sidebarStatus, { _id }, { hidden });
  return true;
}
