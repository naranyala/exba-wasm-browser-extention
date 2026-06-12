use crate::module_system::{ModuleDef, ModuleEvent, ActionResult};
use crate::types::MenuItem;
use serde_json::{Value, Map};
use std::sync::LazyLock;

pub fn module_def() -> ModuleDef {
    ModuleDef::new(
        "menu",
        "0.1.0",
        "Menu item definitions, categorization, and filtering",
        &["selected_category", "search_query", "filtered_items"],
        Some(handle_action),
    )
}

static ALL_ITEMS: LazyLock<Vec<MenuItem>> = LazyLock::new(|| vec![
    MenuItem {
        title: "Accordion".to_string(),
        description: "Collapsible content sections with smooth animations.".to_string(),
        tag: "Component Examples".to_string(),
        tag_class: "tag-wasm".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="m9 12 3-3 3 3"/><path d="m9 12 3 3 3-3"/></svg>"#.to_string(),
        action_id: "demo-accordion".to_string(),
    },
    MenuItem {
        title: "Treeview".to_string(),
        description: "Interactive hierarchical tree with expand and collapse.".to_string(),
        tag: "Component Examples".to_string(),
        tag_class: "tag-wasm".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-4l-3 9L9 3l-3 9H2"/></svg>"#.to_string(),
        action_id: "demo-treeview".to_string(),
    },
    MenuItem {
        title: "Tab Manager".to_string(),
        description: "Query, create, and close browser tabs in real time.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v6"/></svg>"#.to_string(),
        action_id: "demo-tabs".to_string(),
    },
    MenuItem {
        title: "Storage Explorer".to_string(),
        description: "Read, write, and clear extension local storage keys.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>"#.to_string(),
        action_id: "demo-storage".to_string(),
    },
    MenuItem {
        title: "Notifications".to_string(),
        description: "Fire desktop notifications via the chrome.notifications API.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>"#.to_string(),
        action_id: "demo-notifications".to_string(),
    },
    MenuItem {
        title: "Alarms".to_string(),
        description: "Schedule and list periodic alarms with chrome.alarms API.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/></svg>"#.to_string(),
        action_id: "demo-alarms".to_string(),
    },
    MenuItem {
        title: "Bookmarks Explorer".to_string(),
        description: "Browse and manage your browser's bookmark hierarchy.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>"#.to_string(),
        action_id: "demo-bookmarks".to_string(),
    },
    MenuItem {
        title: "History Explorer".to_string(),
        description: "Inspect and search your browsing history.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4-2"/></svg>"#.to_string(),
        action_id: "demo-history".to_string(),
    },
    MenuItem {
        title: "Cookies Explorer".to_string(),
        description: "View and manage cookies for the current session.".to_string(),
        tag: "Browser API".to_string(),
        tag_class: "tag-basic".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M12 12v.01"/><path d="M15.5 8.5v.01"/><path d="M12 15.5v.01"/><path d="M8.5 15.5v.01"/><path d="M15.5 15.5v.01"/></svg>"#.to_string(),
        action_id: "demo-cookies".to_string(),
    },
    MenuItem {
        title: "Audio Visualizer".to_string(),
        description: "Audio player with real-time Web Audio waveform visualization.".to_string(),
        tag: "Component Integration".to_string(),
        tag_class: "tag-int".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>"#.to_string(),
        action_id: "demo-audio-player".to_string(),
    },
    MenuItem {
        title: "Leaflet Map".to_string(),
        description: "Interactive map integration using Leaflet.js.".to_string(),
        tag: "Component Integration".to_string(),
        tag_class: "tag-int".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>"#.to_string(),
        action_id: "demo-leaflet".to_string(),
    },
    MenuItem {
        title: "Mindmap Network".to_string(),
        description: "Dynamic graph visualization using vis-network.".to_string(),
        tag: "Component Integration".to_string(),
        tag_class: "tag-int".to_string(),
        icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 18l12-12"/></svg>"#.to_string(),
        action_id: "demo-vis-network".to_string(),
    },
]);

fn handle_action(
    state: &Map<String, Value>,
    action: &str,
    params: &Map<String, Value>,
) -> ActionResult {
    match action {
        "search" | "filter" => {
            let query = params.get("query").and_then(|v| v.as_str()).unwrap_or(
                state.get("search_query").and_then(|v| v.as_str()).unwrap_or("")
            );
            let category = params.get("category").and_then(|v| v.as_str()).unwrap_or(
                state.get("selected_category").and_then(|v| v.as_str()).unwrap_or("All")
            );

            let filtered: Vec<Value> = get_all_items()
                .into_iter()
                .filter(|item| {
                    if category != "All" && item.tag != category {
                        return false;
                    }
                    crate::modules::fuzzy::fuzzy_match(&item.title, query)
                        || crate::modules::fuzzy::fuzzy_match(&item.description, query)
                        || crate::modules::fuzzy::fuzzy_match(&item.tag, query)
                })
                .map(|i| serde_json::to_value(i).unwrap())
                .collect();

            let mut changes = Map::new();
            changes.insert("search_query".into(), Value::String(query.to_string()));
            changes.insert("selected_category".into(), Value::String(category.to_string()));
            changes.insert("filtered_items".into(), Value::Array(filtered));

            let events = vec![ModuleEvent {
                module: String::new(), // filled by dispatch()
                name: "filtered".to_string(),
                data: serde_json::json!({ "count": changes["filtered_items"].as_array().map(|a| a.len()).unwrap_or(0) }),
            }];

            Ok((changes, events))
        }
        _ => Err(crate::module_system::ModuleError::new(
            "UNKNOWN_ACTION",
            &format!("Menu module: unknown action '{}'", action),
        )),
    }
}

pub fn get_all_items() -> Vec<MenuItem> {
    ALL_ITEMS.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_menu_dispatch_search() {
        let mut state = Map::new();
        state.insert("search_query".into(), Value::String("".into()));
        state.insert("selected_category".into(), Value::String("All".into()));

        let params = serde_json::json!({"query": "tab"});
        let params_map: Map<String, Value> = serde_json::from_value(params).unwrap();
        let result = handle_action(&state, "search", &params_map);
        assert!(result.is_ok());
        let (changes, events) = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "filtered");

        let items = changes.get("filtered_items").and_then(|v| v.as_array());
        assert!(items.is_some_and(|i| i.len() > 0), "should find items matching 'tab'");
    }

    #[wasm_bindgen_test]
    fn test_menu_get_all_items() {
        let items = get_all_items();
        assert_eq!(items.len(), 12);
    }
}
