use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::State,
    http::{Method, StatusCode},
    response::IntoResponse,
    routing::any,
    Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::{AppError, HeaderPair};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockConfig {
    pub path: String,
    pub methods: Vec<String>,
    pub status: u16,
    pub headers: Vec<HeaderPair>,
    pub body: String,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerInfo {
    pub url: String,
    pub id: String,
}

struct ServerState {
    methods: Vec<String>,
    status: u16,
    headers: Vec<HeaderPair>,
    body: String,
}

async fn mock_handler(
    State(state): State<Arc<ServerState>>,
    method: Method,
    body: String,
) -> axum::response::Response {
    let method_str = method.to_string();

    if !state.methods.iter().any(|m| m.eq_ignore_ascii_case(&method_str)) {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }

    let (status, resp_body) = match method {
        Method::GET => {
            (StatusCode::from_u16(state.status).unwrap_or(StatusCode::OK), state.body.clone())
        }
        Method::POST => {
            let b = if body.is_empty() { state.body.clone() } else { body };
            (StatusCode::CREATED, b)
        }
        Method::DELETE => {
            (StatusCode::OK, "{}".to_string())
        }
        _ => {
            let b = if body.is_empty() { state.body.clone() } else { body };
            (StatusCode::OK, b)
        }
    };

    let mut resp = axum::response::Response::new(axum::body::Body::from(resp_body));
    *resp.status_mut() = status;
    resp.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/json"),
    );
    for h in &state.headers {
        if h.key.is_empty() {
            continue;
        }
        if let (Ok(name), Ok(value)) = (
            axum::http::HeaderName::from_bytes(h.key.as_bytes()),
            axum::http::HeaderValue::from_bytes(h.value.as_bytes()),
        ) {
            resp.headers_mut().insert(name, value);
        }
    }
    resp
}

type ShutdownSender = tokio::sync::oneshot::Sender<()>;

pub struct MockManager {
    pub servers: Mutex<HashMap<String, ShutdownSender>>,
}

impl MockManager {
    pub fn new() -> Self {
        Self {
            servers: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for MockManager {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub async fn start_mock_server(
    config: MockConfig,
    state: tauri::State<'_, MockManager>,
) -> Result<MockServerInfo, AppError> {
    let id = format!(
        "mock_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );

    let server_state = Arc::new(ServerState {
        methods: config.methods.clone(),
        status: config.status,
        headers: config.headers.clone(),
        body: config.body.clone(),
    });

    let app = Router::new()
        .route("/*path", any(mock_handler))
        .with_state(server_state);

    let addr = match config.port {
        Some(p) => format!("127.0.0.1:{}", p),
        None => "127.0.0.1:0".to_string(),
    };
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| AppError::Server(format!("No se pudo iniciar el servidor: {}", e)))?;

    let port = listener
        .local_addr()
        .map_err(|e| AppError::Server(format!("Error al obtener puerto: {}", e)))?
        .port();

    let clean_path = config.path.trim_start_matches('/');
    let url = if clean_path.is_empty() {
        format!("http://127.0.0.1:{}", port)
    } else {
        format!("http://127.0.0.1:{}/{}", port, clean_path)
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .ok();
    });

    state.servers.lock().await.insert(id.clone(), tx);

    Ok(MockServerInfo { url, id })
}

#[tauri::command]
pub async fn stop_mock_server(
    id: String,
    state: tauri::State<'_, MockManager>,
) -> Result<(), AppError> {
    let tx = state.servers.lock().await.remove(&id);
    match tx {
        Some(tx) => tx.send(()).map_err(|_| AppError::Server("Error al detener el servidor".to_string())),
        None => Err(AppError::NotFound("Servidor no encontrado".to_string())),
    }
}

#[tauri::command]
pub async fn stop_all_mock_servers(
    state: tauri::State<'_, MockManager>,
) -> Result<(), AppError> {
    let mut servers = state.servers.lock().await;
    for (_, tx) in servers.drain() {
        let _ = tx.send(());
    }
    Ok(())
}
