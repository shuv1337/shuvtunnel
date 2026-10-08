//! XDG base directories used by ShuvTunnel.

use std::env;
use std::path::PathBuf;

fn home() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
}

fn xdg(variable: &str, fallback: &[&str]) -> PathBuf {
    match env::var_os(variable).filter(|value| !value.is_empty()) {
        Some(value) => PathBuf::from(value),
        None => fallback.iter().fold(home(), |path, part| path.join(part)),
    }
}

/// `$XDG_DATA_HOME/shuvtunnel`: tunnel identities and credentials.
pub fn data_dir() -> PathBuf {
    xdg("XDG_DATA_HOME", &[".local", "share"]).join("shuvtunnel")
}

/// `$XDG_CONFIG_HOME/shuvtunnel`: declarative route configuration.
pub fn config_dir() -> PathBuf {
    xdg("XDG_CONFIG_HOME", &[".config"]).join("shuvtunnel")
}

/// `$XDG_STATE_HOME/shuvtunnel`: logs and observed runtime state.
pub fn state_dir() -> PathBuf {
    xdg("XDG_STATE_HOME", &[".local", "state"]).join("shuvtunnel")
}

/// `$XDG_RUNTIME_DIR/shuvtunnel`: sockets and locks for running processes.
pub fn runtime_dir() -> PathBuf {
    match env::var_os("XDG_RUNTIME_DIR").filter(|value| !value.is_empty()) {
        Some(value) => PathBuf::from(value).join("shuvtunnel"),
        None => env::temp_dir().join(format!("shuvtunnel-{}", user_id())),
    }
}

#[cfg(unix)]
fn user_id() -> String {
    // SAFETY: getuid has no preconditions and cannot fail.
    unsafe extern "C" {
        fn getuid() -> u32;
    }
    unsafe { getuid() }.to_string()
}

#[cfg(not(unix))]
fn user_id() -> String {
    env::var("USERNAME").unwrap_or_else(|_| "user".into())
}
