// Coucou runs without a console window: Mochi is the whole UI.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    coucou_lib::run()
}
