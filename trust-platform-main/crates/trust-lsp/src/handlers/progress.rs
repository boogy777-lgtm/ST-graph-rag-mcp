//! LSP progress helpers for work-done and partial results.

use serde::Serialize;
use serde_json::json;
use tower_lsp::lsp_types::notification::Notification;
use tower_lsp::lsp_types::{
    ProgressParams, ProgressParamsValue, ProgressToken, WorkDoneProgress, WorkDoneProgressBegin,
    WorkDoneProgressEnd, WorkDoneProgressReport,
};
use tower_lsp::{lsp_types::notification::Progress, Client};

#[derive(Debug)]
enum RawProgress {}

impl Notification for RawProgress {
    type Params = serde_json::Value;
    const METHOD: &'static str = "$/progress";
}

pub async fn send_work_done_begin(
    client: &Client,
    token: &Option<ProgressToken>,
    title: &str,
    message: Option<String>,
) {
    let Some(token) = token else {
        return;
    };
    let begin = WorkDoneProgressBegin {
        title: title.to_string(),
        cancellable: Some(false),
        message,
        percentage: None,
    };
    let _ = client
        .send_notification::<Progress>(ProgressParams {
            token: token.clone(),
            value: ProgressParamsValue::WorkDone(WorkDoneProgress::Begin(begin)),
        })
        .await;
}

pub async fn send_work_done_report(
    client: &Client,
    token: &Option<ProgressToken>,
    message: Option<String>,
    percentage: Option<u32>,
) {
    let Some(token) = token else {
        return;
    };
    let report = WorkDoneProgressReport {
        cancellable: Some(false),
        message,
        percentage,
    };
    let _ = client
        .send_notification::<Progress>(ProgressParams {
            token: token.clone(),
            value: ProgressParamsValue::WorkDone(WorkDoneProgress::Report(report)),
        })
        .await;
}

pub async fn send_work_done_end(
    client: &Client,
    token: &Option<ProgressToken>,
    message: Option<String>,
) {
    let Some(token) = token else {
        return;
    };
    let end = WorkDoneProgressEnd { message };
    let _ = client
        .send_notification::<Progress>(ProgressParams {
            token: token.clone(),
            value: ProgressParamsValue::WorkDone(WorkDoneProgress::End(end)),
        })
        .await;
}

pub async fn send_partial_result<T: Serialize>(
    client: &Client,
    token: &Option<ProgressToken>,
    value: T,
) {
    let Some(token) = token else {
        return;
    };
    let params = json!({
        "token": token,
        "value": value,
    });
    let _ = client.send_notification::<RawProgress>(params).await;
}
