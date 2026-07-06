use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, State},
    http::Method,
    response::IntoResponse,
    routing::any,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::{AppError, HeaderPair};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDef {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodConfig {
    pub method: String,
    pub status: u16,
    pub headers: Vec<HeaderPair>,
    pub body: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockConfig {
    pub path: String,
    pub methods: Vec<String>,
    pub status: u16,
    pub headers: Vec<HeaderPair>,
    pub body: String,
    pub port: Option<u16>,
    #[serde(default)]
    pub delay_ms: u64,
    #[serde(default)]
    pub method_configs: Vec<MethodConfig>,
    #[serde(default)]
    pub fields: Vec<FieldDef>,
    #[serde(default)]
    pub sample_data: Vec<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerInfo {
    pub url: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestLog {
    pub method: String,
    pub path: String,
    pub body: String,
}

struct AppState {
    methods: Vec<String>,
    method_configs: Vec<MethodConfig>,
    default_status: u16,
    default_headers: Vec<HeaderPair>,
    default_body: String,
    delay_ms: u64,
    fields: Vec<FieldDef>,
    sample_data: Vec<HashMap<String, String>>,
    base_path: String,
    last_request: Mutex<Option<RequestLog>>,
}

fn add_cors_headers(resp: &mut axum::response::Response) {
    resp.headers_mut().insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        axum::http::HeaderValue::from_static("*"),
    );
    resp.headers_mut().insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_METHODS,
        axum::http::HeaderValue::from_static("GET, POST, PUT, DELETE, PATCH, OPTIONS"),
    );
    resp.headers_mut().insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS,
        axum::http::HeaderValue::from_static("*"),
    );
}

fn parse_val(fields: &[FieldDef], key: &str, raw: &str) -> serde_json::Value {
    let t = fields.iter().find(|f| f.name == key).map(|f| f.type_.as_str()).unwrap_or("");
    match t {
        "int" => raw.parse::<i64>().map_or(serde_json::Value::String(raw.into()), |n| serde_json::Value::Number(n.into())),
        "bool" => serde_json::Value::Bool(raw == "true" || raw == "1"),
        _ => serde_json::Value::String(raw.into()),
    }
}

fn build_item(fields: &[FieldDef], id: u64) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    map.insert("id".into(), serde_json::Value::Number(serde_json::Number::from(id)));
    for f in fields {
        let val = match f.type_.as_str() {
            "int" => f.value.as_ref().and_then(|v| v.parse::<i64>().ok()).map_or(serde_json::Value::Null, |n| serde_json::Value::Number(n.into())),
            "bool" => serde_json::Value::Bool(f.value.as_deref() == Some("true") || f.value.as_deref() == Some("1")),
            _ => serde_json::Value::String(f.value.clone().unwrap_or_else(|| "string".to_string())),
        };
        map.insert(f.name.clone(), val);
    }
    serde_json::Value::Object(map)
}

fn build_sample_item(fields: &[FieldDef], record: &HashMap<String, String>, id: u64) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    map.insert("id".into(), serde_json::Value::Number(serde_json::Number::from(id)));
    for f in fields {
        let val = record.get(&f.name).map_or_else(
            || serde_json::Value::Null,
            |raw| parse_val(fields, &f.name, raw),
        );
        map.insert(f.name.clone(), val);
    }
    serde_json::Value::Object(map)
}

fn extract_id(base: &str, req_path: &str) -> Option<String> {
    let b = base.trim_matches('/');
    let r = req_path.trim_matches('/');
    if r.eq_ignore_ascii_case(b) {
        return None;
    }
    if r.starts_with(b) {
        let rest = r[b.len()..].trim_start_matches('/');
        if rest.is_empty() { None } else { Some(rest.to_string()) }
    } else {
        None
    }
}

async fn inspect_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let log = state.last_request.lock().await.take();
    match log {
        Some(log) => (axum::http::StatusCode::OK, Json(log)).into_response(),
        None => (axum::http::StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "No requests yet"}))).into_response(),
    }
}

fn has_smart_data(state: &AppState) -> bool {
    !state.sample_data.is_empty() || !state.fields.is_empty()
}

fn handle_get(state: &AppState, id_segment: Option<&str>, eff_body: &str, eff_status: u16) -> (axum::http::StatusCode, String) {
    if !state.sample_data.is_empty() {
        match id_segment {
            Some(id_str) => {
                let idx = id_str.parse::<usize>().unwrap_or(1).saturating_sub(1);
                if idx < state.sample_data.len() {
                    let item = build_sample_item(&state.fields, &state.sample_data[idx], (idx + 1) as u64);
                    (axum::http::StatusCode::OK, serde_json::to_string(&item).unwrap_or_else(|_| eff_body.to_string()))
                } else {
                    let item = build_sample_item(&state.fields, &state.sample_data[0], 1);
                    (axum::http::StatusCode::OK, serde_json::to_string(&item).unwrap_or_else(|_| eff_body.to_string()))
                }
            }
            None => {
                let items: Vec<serde_json::Value> = state.sample_data.iter().enumerate().map(|(i, record)| {
                    build_sample_item(&state.fields, record, (i + 1) as u64)
                }).collect();
                (axum::http::StatusCode::OK, serde_json::to_string(&items).unwrap_or_else(|_| eff_body.to_string()))
            }
        }
    } else if !state.fields.is_empty() {
        match id_segment {
            Some(id_str) => {
                let id_num = id_str.parse::<u64>().unwrap_or(1);
                let item = build_item(&state.fields, id_num);
                (axum::http::StatusCode::OK, serde_json::to_string(&item).unwrap_or_else(|_| eff_body.to_string()))
            }
            None => {
                let items: Vec<serde_json::Value> = (1..=3).map(|i| build_item(&state.fields, i)).collect();
                (axum::http::StatusCode::OK, serde_json::to_string(&items).unwrap_or_else(|_| eff_body.to_string()))
            }
        }
    } else {
        (axum::http::StatusCode::from_u16(eff_status).unwrap_or(axum::http::StatusCode::OK), eff_body.to_string())
    }
}

fn handle_post(state: &AppState, body: &str, eff_body: &str) -> (axum::http::StatusCode, String) {
    if !has_smart_data(state) {
        let b = if body.is_empty() { eff_body.to_string() } else { body.to_string() };
        return (axum::http::StatusCode::CREATED, b);
    }

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let id_num = ts % 10000 + 1;
    let base_item = if !state.sample_data.is_empty() {
        build_sample_item(&state.fields, &state.sample_data[0], id_num)
    } else {
        build_item(&state.fields, id_num)
    };

    let mut item = base_item;
    if let Ok(req_json) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(obj) = req_json.as_object() {
            for (k, v) in obj {
                if let Some(map) = item.as_object_mut() {
                    map.insert(k.clone(), v.clone());
                }
            }
        }
    }
    (axum::http::StatusCode::CREATED, serde_json::to_string(&item).unwrap_or_else(|_| eff_body.to_string()))
}

fn handle_delete(state: &AppState, id_segment: Option<String>, eff_body: &str) -> (axum::http::StatusCode, String) {
    if !has_smart_data(state) {
        return (axum::http::StatusCode::OK, eff_body.to_string());
    }
    let id_val = id_segment.unwrap_or_else(|| "unknown".to_string());
    let resp = serde_json::json!({ "deleted": true, "id": id_val });
    (axum::http::StatusCode::OK, serde_json::to_string(&resp).unwrap_or_else(|_| eff_body.to_string()))
}

fn handle_update(state: &AppState, id_segment: Option<String>, body: &str, eff_body: &str) -> (axum::http::StatusCode, String) {
    if !has_smart_data(state) {
        let b = if body.is_empty() { eff_body.to_string() } else { body.to_string() };
        return (axum::http::StatusCode::OK, b);
    }
    let id_val = id_segment.unwrap_or_else(|| "unknown".to_string());
    let id_num = id_val.parse::<u64>().unwrap_or(1);
    let base_item = if !state.sample_data.is_empty() {
        build_sample_item(&state.fields, &state.sample_data[0], id_num)
    } else {
        build_item(&state.fields, id_num)
    };

    let mut item = base_item;
    if let Ok(req_json) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(obj) = req_json.as_object() {
            for (k, v) in obj {
                if let Some(map) = item.as_object_mut() {
                    map.insert(k.clone(), v.clone());
                }
            }
        }
    }
    let resp = serde_json::json!({ "updated": true, "id": id_val, "data": item });
    (axum::http::StatusCode::OK, serde_json::to_string(&resp).unwrap_or_else(|_| eff_body.to_string()))
}

async fn mock_handler(
    State(state): State<Arc<AppState>>,
    method: Method,
    Path(req_path): Path<String>,
    body: String,
) -> axum::response::Response {
    if method == Method::OPTIONS {
        let mut resp = axum::response::Response::new(axum::body::Body::empty());
        *resp.status_mut() = axum::http::StatusCode::OK;
        add_cors_headers(&mut resp);
        return resp;
    }

    let method_str = method.to_string().to_uppercase();

    if !state.methods.iter().any(|m| m.eq_ignore_ascii_case(&method_str)) {
        let mut resp = axum::http::StatusCode::METHOD_NOT_ALLOWED.into_response();
        add_cors_headers(&mut resp);
        return resp;
    }

    *state.last_request.lock().await = Some(RequestLog {
        method: method_str.clone(),
        path: req_path.clone(),
        body: body.clone(),
    });

    if state.delay_ms > 0 {
        tokio::time::sleep(Duration::from_millis(state.delay_ms)).await;
    }

    let mc = state.method_configs.iter().find(|m| m.method.eq_ignore_ascii_case(&method_str));
    let eff_status = mc.as_ref().map(|m| m.status).unwrap_or(state.default_status);
    let eff_headers = mc.as_ref().map(|m| &m.headers).unwrap_or(&state.default_headers);
    let eff_body = mc.as_ref().map(|m| &m.body).unwrap_or(&state.default_body);

    let id_segment = extract_id(&state.base_path, &req_path);

    let (status, resp_body) = match method_str.as_str() {
        "GET" => handle_get(&state, id_segment.as_deref(), &eff_body, eff_status),
        "POST" => handle_post(&state, &body, &eff_body),
        "DELETE" => handle_delete(&state, id_segment, &eff_body),
        _ => handle_update(&state, id_segment, &body, &eff_body),
    };

    let mut resp = axum::response::Response::new(axum::body::Body::from(resp_body));
    *resp.status_mut() = status;
    resp.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/json"),
    );
    for h in eff_headers {
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
    add_cors_headers(&mut resp);
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

    let clean_path = config.path.trim_start_matches('/').to_string();

    let app_state = Arc::new(AppState {
        methods: config.methods.clone(),
        method_configs: config.method_configs.clone(),
        default_status: config.status,
        default_headers: config.headers.clone(),
        default_body: config.body.clone(),
        delay_ms: config.delay_ms,
        fields: config.fields.clone(),
        sample_data: config.sample_data.clone(),
        base_path: clean_path.clone(),
        last_request: Mutex::new(None),
    });

    let app = Router::new()
        .route("/__inspect", any(inspect_handler))
        .route("/*path", any(mock_handler))
        .with_state(app_state);

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
