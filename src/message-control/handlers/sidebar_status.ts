import { SidebarStatus } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async (_: any) => {
  const status = await queryDb.find<SidebarStatus>(db.sidebarStatus);
  if (status.length === 0) {
    await queryDb.insert<SidebarStatus>(db.sidebarStatus, { hidden: false });
  }
  return (await queryDb.find<SidebarStatus>(db.sidebarStatus))[0];
};

export async function sidebar_status_set(_: any, _id: string, hidden: boolean) {
  await queryDb.update(db.sidebarStatus, { _id }, { hidden });
  return true;
}
