// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// [核心改动] 直接从我们的库中 use 所有东西
use musicbox_lib;

fn main() {
    musicbox_lib::run();
}
