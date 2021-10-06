export const IPC_EVENTS = {
  // events from rendering process
  title_documents: 'title_documents',
  menu_viewer: 'menu_viewer',
  document_content_path: 'document_content_path',
  document_tabs: 'document_tabs',
  search_suggestions: 'search_suggestions',
  search_text: 'search_text',
  search_content: 'search_content',
  subject_document: 'subject_document',
  subject_items: 'subject_items',
  subject_items_delete: 'subject_items_delete',
  subject_document_delete: 'subject_document_delete',
  subject_items_store: 'subject_items_store',
  custom_documents: 'custom_documents',
  custom_documents_delete: 'custom_documents_delete',
  custom_documents_store: 'custom_documents_store',
  history_data: 'history_data',
  history_data_item: 'history_data_item',
  notes_items: 'notes_items',
  notes_items_store: 'notes_items_store',
  notes_items_delete: 'notes_items_delete',
  notes_items_rename: 'notes_items_rename',
  notes_items_update_content: 'notes_items_update_content',
  notes_items_get: 'notes_items_get',
  notes_references: 'notes_references',
  notes_references_store: 'notes_references_store',
  notes_references_bible_store: 'notes_references_bible_store',
  notes_references_get: 'notes_references_get',
  notes_references_sync: 'notes_references_sync',
  notes_references_bible_sync: 'notes_references_bible_sync',
  notes_references_put: 'notes_references_put',
  notes_references_bible_get: 'notes_references_bible_get',
  notes_references_bible_add: 'notes_references_bible_add',
  notes_references_bible_remove: 'notes_references_bible_remove',
  notes_export_pdf: 'notes_export_pdf',
  bible_indexes: 'bible_indexes',
  bible_books: 'bible_books',
  bible_search: 'bible_search',
  sidebar_status: 'sidebar_status',
  sidebar_status_set: 'sidebar_status_set',
  initialized_app: 'initialized_app',
  get_asset: 'get_asset',
  backup_status: 'backup_status',
  backup_status_put: 'backup_status_put',
  backup_reminder: 'backup_reminder',
  backup_login: 'backup_login',
  restart_app: 'restart_app',
  start_download_update: 'start_download_update',
  started_to_update: 'started_to_update',
  quit_and_install_update: 'quit_and_install_update',
  // events from main process
  custom_document_upload_progress: 'custom_document_upload_progress',
  open_modal_document_from_main: 'open_modal_document_from_main',
  backup_progression: 'backup_progression',
  backup_access_status: 'backup_access_status',
  open_backup_modal_from_main: 'open_backup_modal_from_main',
  app_update_menu: 'app_update_menu',
  toggle_sidebar: 'toggle_sidebar',
  switch_on_menu: 'switch_on_menu',
  notify_for_new_update: 'notify_for_new_update',
  switch_on_options: 'switch_on_options',
};
