use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse};
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::AppError;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthUserInfo {
    pub email: String,
    pub name: String,
    pub access_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallback {
    pub user_id: String,
    pub secret: String,
}

#[derive(Default)]
pub struct OAuthState(pub Arc<Mutex<HashMap<u16, Option<(String, String)>>>>);

#[tauri::command]
pub async fn start_oauth_server(
    state: tauri::State<'_, OAuthState>,
) -> Result<u16, AppError> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| AppError::Server(format!("No se pudo iniciar servidor OAuth: {}", e)))?;

    let port = listener
        .local_addr()
        .map_err(|e| AppError::Server(format!("Error al obtener puerto: {}", e)))?
        .port();

    state.0.lock().await.insert(port, None);

    let state_clone = state.0.clone();
    let app = Router::new().route(
        "/callback",
        get(move |Query(params): Query<HashMap<String, String>>| async move {
            let user_id = params.get("userId").cloned().unwrap_or_default();
            let secret = params.get("secret").cloned().unwrap_or_default();
            state_clone.lock().await.insert(port, Some((user_id, secret)));
            (
                StatusCode::OK,
                [("Content-Type", "text/html; charset=utf-8")],
                "<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#fafafa'><div style='text-align:center'><h2 style='color:#18181b;margin-bottom:8px'>✅ Sesión iniciada</h2><p style='color:#71717a'>Ya puedes cerrar esta ventana y volver a GReq</p></div></body></html>",
            )
        }),
    );

    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok(port)
}

#[tauri::command]
pub async fn wait_oauth_callback(
    port: u16,
    state: tauri::State<'_, OAuthState>,
) -> Result<OAuthCallback, AppError> {
    let deadline = Duration::from_secs(180);

    for _ in 0..(deadline.as_millis() / 500) {
        {
            let mut map = state.0.lock().await;
            if let Some(Some((user_id, secret))) = map.remove(&port) {
                return Ok(OAuthCallback { user_id, secret });
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Err(AppError::NotFound(
        "Tiempo de espera agotado para el inicio de sesión".to_string(),
    ))
}

#[tauri::command]
pub async fn start_oauth_webview(
    app_handle: tauri::AppHandle,
    url: String,
) -> Result<OAuthCallback, AppError> {
    let parsed = url::Url::parse(&url)
        .map_err(|e| AppError::Server(format!("URL inválida: {}", e)))?;

    let (tx, rx) = tokio::sync::oneshot::channel::<OAuthCallback>();
    let callback = Arc::new(std::sync::Mutex::new(Some(tx)));

    let label = format!(
        "oauth_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );

    let webview = tauri::WebviewWindowBuilder::new(
        &app_handle,
        label,
        tauri::WebviewUrl::External(parsed),
    )
    .inner_size(800.0, 700.0)
    .title("GReq — Iniciar sesión")
    .on_navigation({
        let callback = callback.clone();
        move |nav_url| {
            let url_str = nav_url.as_str();
            if url_str.contains("cloud.appwrite.io/console/auth/oauth2/success") {
                let params: HashMap<String, String> =
                    nav_url.query_pairs().into_owned().collect();
                let user_id = params.get("key").cloned().unwrap_or_default();
                let secret = params.get("secret").cloned().unwrap_or_default();
                if let Some(sender) = callback.lock().unwrap().take() {
                    let _ = sender.send(OAuthCallback { user_id, secret });
                }
                return false;
            }
            true
        }
    })
    .build()
    .map_err(|e| AppError::Server(format!(
        "Error al crear la ventana de inicio de sesión: {}", e
    )))?;

    let result = tokio::time::timeout(Duration::from_secs(180), rx).await;

    let _ = webview.close();

    match result {
        Ok(Ok(cb)) => Ok(cb),
        Ok(Err(_)) => Err(AppError::NotFound(
            "Inicio de sesión cancelado".to_string(),
        )),
        Err(_) => Err(AppError::NotFound(
            "Tiempo de espera agotado para el inicio de sesión".to_string(),
        )),
    }
}

fn random_state(len: usize) -> String {
    let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars().collect();
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    (0..len).map(|i| {
        let idx = seed.wrapping_mul((i + 1) as u128) as usize % chars.len();
        chars[idx]
    }).collect()
}

#[tauri::command]
pub async fn login_with_github(
    client_id: String,
    client_secret: String,
) -> Result<OAuthUserInfo, AppError> {
    let state = random_state(16);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| AppError::Server(format!("No se pudo iniciar servidor: {}", e)))?;
    let port = listener.local_addr().map_err(|e| AppError::Server(format!("Error al obtener puerto: {}", e)))?.port();

    let (code_tx, code_rx) = tokio::sync::oneshot::channel::<String>();
    let code_tx = Arc::new(tokio::sync::Mutex::new(Some(code_tx)));
    let expected_state = state.clone();

    let app = Router::new().route(
        "/callback",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let code_tx = code_tx.clone();
            let expected_state = expected_state.clone();
            async move {
                let received_state = params.get("state").cloned().unwrap_or_default();
                if received_state != expected_state {
                    return (StatusCode::BAD_REQUEST, "State inválido").into_response();
                }
                if let Some(code) = params.get("code") {
                    if let Some(tx) = code_tx.lock().await.take() {
                        let _ = tx.send(code.clone());
                    }
                }
                (StatusCode::OK, Html(r#"<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#fafafa'><div style='text-align:center'><h2 style='color:#18181b;margin-bottom:8px'>✅ Sesión iniciada</h2><p style='color:#71717a'>Ya puedes cerrar esta ventana y volver a GReq</p></div></body></html>"#)).into_response()
            }
        }),
    );

    let server_handle = tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    let mut oauth_url = url::Url::parse("https://github.com/login/oauth/authorize")
        .map_err(|e| AppError::Server(format!("Error al construir URL: {}", e)))?;
    oauth_url.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("scope", "user:email")
        .append_pair("state", &state);

    webbrowser::open(oauth_url.as_str())
        .map_err(|e| AppError::Server(format!("No se pudo abrir el navegador: {}", e)))?;

    let code = tokio::time::timeout(Duration::from_secs(180), code_rx)
        .await
        .map_err(|_| AppError::NotFound("Tiempo de espera agotado para el inicio de sesión".to_string()))?
        .map_err(|_| AppError::NotFound("Inicio de sesión cancelado".to_string()))?;

    server_handle.abort();

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Network(format!("Error al crear cliente HTTP: {}", e)))?;

    if cfg!(debug_assertions) {
        eprintln!("[login_with_github] exchanging code for token...");
    }

    let token_resp = http
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("code", &code),
        ])
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Error al obtener token: {}", e)))?;

    let token_status = token_resp.status();
    let token_body = token_resp.text().await
        .map_err(|e| AppError::Network(format!("Error al leer respuesta de token: {}", e)))?;

    if cfg!(debug_assertions) {
        eprintln!("[login_with_github] token response status: {}, body: {}", token_status, token_body);
    }

    let token_data: HashMap<String, String> = serde_json::from_str(&token_body)
        .map_err(|e| AppError::Network(format!("Error al parsear token: {} — body: {}", e, token_body)))?;

    let access_token = token_data.get("access_token").ok_or_else(|| {
        let desc = token_data.get("error_description")
            .or_else(|| token_data.get("error"))
            .cloned()
            .unwrap_or_else(|| "Error desconocido".to_string());
        AppError::Network(format!("Error de autenticación: {}", desc))
    })?;

    let emails: Vec<serde_json::Value> = http
        .get("https://api.github.com/user/emails")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "GReq")
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Error al obtener emails: {}", e)))?
        .json()
        .await
        .map_err(|e| AppError::Network(format!("Error al parsear emails: {}", e)))?;

    let email = emails.iter()
        .find(|e| e["primary"].as_bool().unwrap_or(false))
        .or_else(|| emails.first())
        .and_then(|e| e["email"].as_str().map(String::from))
        .ok_or_else(|| AppError::NotFound("No se pudo obtener el email del usuario".to_string()))?;

    let user_data: serde_json::Value = http
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "GReq")
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Error al obtener usuario: {}", e)))?
        .json()
        .await
        .map_err(|e| AppError::Network(format!("Error al parsear usuario: {}", e)))?;

    let name = user_data["name"].as_str()
        .or_else(|| user_data["login"].as_str())
        .unwrap_or("Usuario de GitHub")
        .to_string();

    Ok(OAuthUserInfo { email, name, access_token: access_token.clone() })
}

#[tauri::command]
pub async fn login_with_google(
    client_id: String,
    client_secret: String,
) -> Result<OAuthUserInfo, AppError> {
    let state = random_state(16);
    let port: u16 = 14211;

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| AppError::Server(format!("No se pudo iniciar servidor: {}", e)))?;

    let (code_tx, code_rx) = tokio::sync::oneshot::channel::<String>();
    let code_tx = Arc::new(tokio::sync::Mutex::new(Some(code_tx)));
    let expected_state = state.clone();

    let app = Router::new().route(
        "/callback",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let code_tx = code_tx.clone();
            let expected_state = expected_state.clone();
            async move {
                let received_state = params.get("state").cloned().unwrap_or_default();
                if received_state != expected_state {
                    return (StatusCode::BAD_REQUEST, "State inválido").into_response();
                }
                if let Some(code) = params.get("code") {
                    if let Some(tx) = code_tx.lock().await.take() {
                        let _ = tx.send(code.clone());
                    }
                }
                (StatusCode::OK, Html(r#"<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#fafafa'><div style='text-align:center'><h2 style='color:#18181b;margin-bottom:8px'>✅ Sesión iniciada</h2><p style='color:#71717a'>Ya puedes cerrar esta ventana y volver a GReq</p></div></body></html>"#)).into_response()
            }
        }),
    );

    let server_handle = tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    let mut oauth_url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|e| AppError::Server(format!("Error al construir URL: {}", e)))?;
    oauth_url.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile")
        .append_pair("state", &state)
        .append_pair("access_type", "offline");

    webbrowser::open(oauth_url.as_str())
        .map_err(|e| AppError::Server(format!("No se pudo abrir el navegador: {}", e)))?;

    let code = tokio::time::timeout(Duration::from_secs(180), code_rx)
        .await
        .map_err(|_| AppError::NotFound("Tiempo de espera agotado para el inicio de sesión".to_string()))?
        .map_err(|_| AppError::NotFound("Inicio de sesión cancelado".to_string()))?;

    server_handle.abort();

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Network(format!("Error al crear cliente HTTP: {}", e)))?;

    let token_params = [
        ("code", &code),
        ("client_id", &client_id),
        ("client_secret", &client_secret),
        ("redirect_uri", &redirect_uri),
        ("grant_type", &"authorization_code".to_string()),
    ];

    let token_resp = http
        .post("https://oauth2.googleapis.com/token")
        .form(&token_params)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Error al obtener token: {}", e)))?;

    let token_body: serde_json::Value = token_resp.json().await
        .map_err(|e| AppError::Network(format!("Error al parsear token: {}", e)))?;

    let access_token = token_body["access_token"].as_str()
        .ok_or_else(|| {
            let desc = token_body.get("error_description")
                .or_else(|| token_body.get("error"))
                .and_then(|v| v.as_str())
                .unwrap_or("Error desconocido");
            AppError::Network(format!("Error de autenticación: {}", desc))
        })?;

    let user_info: serde_json::Value = http
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Error al obtener usuario: {}", e)))?
        .json()
        .await
        .map_err(|e| AppError::Network(format!("Error al parsear usuario: {}", e)))?;

    let email = user_info["email"].as_str()
        .ok_or_else(|| AppError::NotFound("No se pudo obtener el email del usuario".to_string()))?
        .to_string();

    let name = user_info["name"].as_str()
        .or_else(|| user_info["given_name"].as_str())
        .unwrap_or("Usuario de Google")
        .to_string();

    Ok(OAuthUserInfo { email, name, access_token: access_token.to_string() })
}
