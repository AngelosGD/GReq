use serde::{Deserialize, Serialize};
use std::time::Instant;
use thiserror::Error;

mod auth;
mod mock;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Invalid HTTP method: {0}")]
    InvalidMethod(String),
    #[error("Server error: {0}")]
    Server(String),
    #[error("Not found: {0}")]
    NotFound(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestInput {
    url: String,
    method: String,
    headers: Vec<HeaderPair>,
    body: Option<String>,
    body_type: Option<String>,
    auth_type: Option<String>,
    auth_value: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HeaderPair {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResponseOutput {
    status: u16,
    status_text: String,
    headers: Vec<HeaderPair>,
    body: String,
    duration_ms: u64,
}

#[tauri::command]
async fn make_request(input: RequestInput) -> Result<ResponseOutput, AppError> {
    let start = Instant::now();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Network(format!("Failed to create client: {}", e)))?;

    let url = if input.url.starts_with("http://") || input.url.starts_with("https://") {
        input.url.clone()
    } else {
        format!("http://{}", input.url)
    };

    let method_str = if input.method.eq_ignore_ascii_case("UPDATE") { "PUT" } else { &input.method };
    let method = reqwest::Method::from_bytes(method_str.as_bytes())
        .map_err(|_| AppError::InvalidMethod(input.method.clone()))?;

    let mut req = client.request(method, &url);

    for h in &input.headers {
        if !h.key.is_empty() {
            req = req.header(&h.key, &h.value);
        }
    }

    if let Some(body) = &input.body {
        if !body.is_empty() {
            req = match input.body_type.as_deref() {
                Some("text") => req.body(body.clone()).header("Content-Type", "text/plain"),
                Some("form") => req.body(body.clone()).header(
                    "Content-Type",
                    "application/x-www-form-urlencoded",
                ),
                _ => {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(body) {
                        req.json(&json_val)
                    } else {
                        req.body(body.clone())
                            .header("Content-Type", "application/json")
                    }
                }
            };
        }
    }

    match input.auth_type.as_deref() {
        Some("Bearer") => {
            if let Some(val) = &input.auth_value {
                req = req.bearer_auth(val);
            }
        }
        Some("Basic") => {
            if let Some(val) = &input.auth_value {
                if let Some((user, pass)) = val.split_once(':') {
                    req = req.basic_auth(user.to_string(), Some(pass.to_string()));
                } else {
                    req = req.basic_auth(val.to_string(), Some(""));
                }
            }
        }
        _ => {}
    }

    if cfg!(debug_assertions) {
        eprintln!("[make_request] URL: {} method: {}", url, input.method);
    }
    let resp = req.send().await.map_err(|e| {
        AppError::Network(format!("Request failed ({} {}): {:?}", input.method, url, e))
    })?;

    let status = resp.status().as_u16();
    let status_text = resp
        .status()
        .canonical_reason()
        .unwrap_or("Unknown")
        .to_string();

    let resp_headers: Vec<HeaderPair> = resp
        .headers()
        .iter()
        .filter_map(|(k, v)| {
            v.to_str().ok().map(|val| HeaderPair {
                key: k.to_string(),
                value: val.to_string(),
            })
        })
        .collect();

    let body = resp
        .text()
        .await
        .map_err(|e| AppError::Network(format!("Failed to read response body: {}", e)))?;

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(ResponseOutput {
        status,
        status_text,
        headers: resp_headers,
        body,
        duration_ms,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(mock::MockManager::new())
        .manage(auth::OAuthState::default())
        .invoke_handler(tauri::generate_handler![
            make_request,
            mock::start_mock_server,
            mock::stop_mock_server,
            mock::stop_all_mock_servers,
            auth::start_oauth_server,
            auth::wait_oauth_callback,
            auth::start_oauth_webview,
            auth::login_with_github,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
