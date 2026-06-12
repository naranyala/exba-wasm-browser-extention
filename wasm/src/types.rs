use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MenuItem {
    pub title: String,
    pub description: String,
    pub tag: String,
    pub tag_class: String,
    pub icon_svg: String,
    pub action_id: String,
}
