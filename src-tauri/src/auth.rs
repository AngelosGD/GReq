use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::Query;
use axum::http::StatusCode;
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::AppError;

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
