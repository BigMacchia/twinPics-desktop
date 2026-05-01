mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::ClipState::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_indices,
            commands::add_index,
            commands::list_index_tags,
            commands::search_by_image,
            commands::search_by_text,
            commands::write_temp_image_b64,
            commands::remove_index,
            commands::remove_all_indices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
