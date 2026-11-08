//! Skill Hub 桌面端后端命令
//!
//! 前端通过 `window.__TAURI__.core.invoke` 调用这些命令：
//!   - default_roots     返回本机候选的技能目录（不保证存在）
//!   - scan_roots        扫描若干根目录，解析 SKILL.md 与 *_meta.json
//!   - pick_directory    唤起系统目录选择器
//!   - write_skill       把一份技能写到目标 Agent 目录（覆盖前自动备份）
//!   - remove_skill      卸载：移到应用数据目录的回收站，而不是直接删除
//!   - window_action     无边框窗口的最小化 / 最大化 / 关闭

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(not(windows))]
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

const MAX_FILE_BYTES: u64 = 512 * 1024;
const MAX_DEPTH: usize = 4;
const MAX_SKILLS_PER_ROOT: usize = 800;
const META_FILES: [&str; 3] = ["_skillhub_meta.json", "_user_meta.json", "_meta.json"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillFile {
    name: String,
    content: String,
    size: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScannedSkill {
    name: String,
    display_name: Option<String>,
    description: String,
    dir: String,
    content: String,
    files: Vec<SkillFile>,
    updated_at: u64,
    meta_file: Option<String>,
    meta: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanRoot {
    path: String,
    exists: bool,
    skills: Vec<ScannedSkill>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteFile {
    name: String,
    content: String,
}

/* ---------------- 工具 ---------------- */

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

/// 只允许相对、无穿越的文件名
fn is_safe_relative(name: &str) -> bool {
    if name.is_empty() || name.len() > 200 {
        return false;
    }
    if name.starts_with('/') || name.starts_with('\\') || name.contains("..") {
        return false;
    }
    // 盘符形式 C:\xxx
    if name.len() > 1 && name.as_bytes()[1] == b':' {
        return false;
    }
    true
}

/// 真实文件里存在尾随逗号，宽松解析一次
fn parse_loose_json(text: &str) -> Option<serde_json::Value> {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
        return Some(v);
    }
    // 容错：去掉尾随逗号后再解析。
    // 必须按 char 处理——按字节遍历会把 UTF-8 多字节字符拆成 Latin-1 乱码，
    // 而真实 _skillhub_meta.json 里的 name 常常是中文，且带尾随逗号必然走这条路。
    let cleaned: String = {
        let src = text.trim_start_matches('\u{feff}');
        let chars: Vec<char> = src.chars().collect();
        let mut out = String::with_capacity(src.len());
        let mut i = 0;
        while i < chars.len() {
            let ch = chars[i];
            if ch == ',' {
                let mut j = i + 1;
                while j < chars.len() && chars[j].is_whitespace() {
                    j += 1;
                }
                if j < chars.len() && (chars[j] == ']' || chars[j] == '}') {
                    i += 1;
                    continue;
                }
            }
            out.push(ch);
            i += 1;
        }
        out
    };
    serde_json::from_str::<serde_json::Value>(&cleaned).ok()
}

fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let mut name = None;
    let mut desc = None;
    let mut inside = false;

    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if index == 0 && trimmed == "---" {
            inside = true;
            continue;
        }
        if inside && trimmed == "---" {
            break;
        }
        if !inside {
            if index > 0 && !trimmed.is_empty() && !trimmed.starts_with('#') {
                break;
            }
            continue;
        }
        if let Some(value) = trimmed.strip_prefix("name:") {
            let value = value.trim().trim_matches('"').trim_matches('\'').trim();
            if !value.is_empty() {
                name = Some(value.to_string());
            }
        } else if let Some(value) = trimmed.strip_prefix("description:") {
            let value = value.trim().trim_matches('"').trim_matches('\'').trim();
            if !value.is_empty() {
                desc = Some(value.to_string());
            }
        }
    }
    (name, desc)
}

fn read_meta(dir: &Path) -> Option<(String, serde_json::Value)> {
    for file in META_FILES {
        let path = dir.join(file);
        if !path.is_file() {
            continue;
        }
        if let Ok(text) = fs::read_to_string(&path) {
            if let Some(value) = parse_loose_json(&text) {
                return Some((file.to_string(), value));
            }
        }
    }
    None
}

fn copy_dir(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest = to.join(entry.file_name());
        if path.is_dir() {
            copy_dir(&path, &dest)?;
        } else {
            fs::copy(&path, &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/* ---------------- 命令 ---------------- */

#[tauri::command]
fn default_roots() -> Vec<String> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };
    let candidates = [
        ".claude/skills",
        ".codex/skills",
        ".workbuddy/skills",
        ".trae/skills",
        "Doubao/skills",
        ".skillhub/skills",
    ];
    candidates
        .iter()
        .map(|rel| home.join(rel).to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
fn scan_roots(roots: Vec<String>) -> Vec<ScanRoot> {
    roots
        .iter()
        .map(|root| {
            let path = PathBuf::from(root);
            if !path.is_dir() {
                return ScanRoot {
                    path: root.clone(),
                    exists: false,
                    skills: Vec::new(),
                };
            }

            let mut skills: Vec<ScannedSkill> = Vec::new();

            for entry in WalkDir::new(&path)
                .max_depth(MAX_DEPTH)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let file_name = entry.file_name().to_string_lossy().to_string();
                if !file_name.eq_ignore_ascii_case("SKILL.md") {
                    continue;
                }

                let dir = entry.path().parent().unwrap_or(&path).to_path_buf();
                if fs::metadata(entry.path()).map(|m| m.len()).unwrap_or(0) > MAX_FILE_BYTES {
                    continue;
                }
                let content = match fs::read_to_string(entry.path()) {
                    Ok(text) => text,
                    Err(_) => continue,
                };

                let (fm_name, fm_desc) = parse_frontmatter(&content);
                let folder = dir
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let name = fm_name.clone().unwrap_or_else(|| folder.clone());

                let mut files = Vec::new();
                if let Ok(read_dir) = fs::read_dir(&dir) {
                    for item in read_dir.filter_map(|e| e.ok()) {
                        let p = item.path();
                        if !p.is_file() {
                            continue;
                        }
                        let fname = item.file_name().to_string_lossy().to_string();
                        if fname.starts_with('.') {
                            continue;
                        }
                        let size = fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                        if size > MAX_FILE_BYTES {
                            continue;
                        }
                        let text = fs::read_to_string(&p).unwrap_or_default();
                        files.push(SkillFile {
                            name: fname,
                            content: text,
                            size: size as usize,
                        });
                    }
                }
                files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

                let (meta_file, meta) = match read_meta(&dir) {
                    Some((file, value)) => (Some(file), Some(value)),
                    None => (None, None),
                };

                let display_name = meta
                    .as_ref()
                    .and_then(|v| v.get("name"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());

                let updated_at = fs::metadata(entry.path())
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                skills.push(ScannedSkill {
                    name,
                    display_name,
                    description: fm_desc.unwrap_or_default(),
                    dir: dir.to_string_lossy().to_string(),
                    content,
                    files,
                    updated_at,
                    meta_file,
                    meta,
                });

                if skills.len() >= MAX_SKILLS_PER_ROOT {
                    break;
                }
            }

            ScanRoot {
                path: root.clone(),
                exists: true,
                skills,
            }
        })
        .collect()
}

#[tauri::command]
fn pick_directory(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn write_skill(
    app: tauri::AppHandle,
    root: String,
    name: String,
    files: Vec<WriteFile>,
) -> Result<String, String> {
    if root.trim().is_empty() {
        return Err("目标目录为空".into());
    }
    if !is_safe_relative(&name) {
        return Err(format!("非法的技能名：{name}"));
    }

    let root_path = PathBuf::from(&root);
    fs::create_dir_all(&root_path).map_err(|e| format!("创建目标目录失败：{e}"))?;

    let target = root_path.join(&name);

    // 覆盖前先备份，避免不可逆
    if target.exists() {
        let backup_root = data_dir(&app)?.join("backups");
        let dest = backup_root.join(format!("{}-{}", now_millis(), name));
        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        copy_dir(&target, &dest)?;
        // 刻意不删除整个目录再重建：扫描时有单文件大小上限（MAX_FILE_BYTES），
        // 超限的大文件不会出现在 files 列表里，若先 remove_dir_all 会把它们静默丢掉。
        // 这里只覆盖传入的同名文件，其余原样保留。
    }

    fs::create_dir_all(&target).map_err(|e| e.to_string())?;

    for file in files {
        if !is_safe_relative(&file.name) {
            return Err(format!("非法的文件名：{}", file.name));
        }
        let path = target.join(&file.name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&path, file.content).map_err(|e| format!("写入失败：{e}"))?;
    }

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn remove_skill(app: tauri::AppHandle, dir: String) -> Result<String, String> {
    let path = PathBuf::from(&dir);
    if !path.exists() {
        return Err("目录不存在".into());
    }

    let trash = data_dir(&app)?
        .join("trash")
        .join(now_millis().to_string());
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;

    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "skill".into());
    let dest = trash.join(name);

    if fs::rename(&path, &dest).is_err() {
        copy_dir(&path, &dest)?;
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    }

    Ok(dest.to_string_lossy().to_string())
}

/// 删除技能目录下的单个文件（清除元数据标记时用）
#[tauri::command]
fn delete_skill_file(dir: String, name: String) -> Result<(), String> {
    if !is_safe_relative(&name) {
        return Err(format!("非法的文件名：{name}"));
    }
    let path = PathBuf::from(&dir).join(&name);
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| format!("删除失败：{e}"))
}

#[tauri::command]
fn window_action(window: tauri::Window, action: String) -> Result<(), String> {
    match action.as_str() {
        "minimize" => window.minimize().map_err(|e| e.to_string()),
        "maximize" => {
            let maximized = window.is_maximized().unwrap_or(false);
            if maximized {
                window.unmaximize().map_err(|e| e.to_string())
            } else {
                window.maximize().map_err(|e| e.to_string())
            }
        }
        "close" => window.close().map_err(|e| e.to_string()),
        _ => Err(format!("未知的窗口操作：{action}")),
    }
}

/* ============================================================
   数据目录：按平台分流
   ------------------------------------------------------------
   Windows —— 便携形态，数据写在 exe 旁边，不碰系统目录。
      <exe 目录>\data\backups   覆盖同步前的自动备份
      <exe 目录>\data\trash     卸载的 SKILL，可捞回
      <exe 目录>\data\webview   WebView2 配置 + localStorage
      整个文件夹拷走即带走全部状态；放任意目录都能跑，不依赖安装程序。

   macOS —— 标准形态（不做便携），遵循 Apple 的目录规范：
      ~/Library/Application Support/com.skillhub.desktop   索引 / 备份 / 回收站
      ~/Library/Caches/com.skillhub.desktop                缓存
      ~/Library/WebKit/com.skillhub.desktop                WKWebView 数据（localStorage）
      ~/Library/Logs/com.skillhub.desktop                  日志
      ~/Library/Preferences/com.skillhub.desktop.plist     偏好设置

   上面这份清单是「唯一事实来源」：界面展示它，卸载脚本按它清理。
   任何新增的落盘位置，都必须同时更新 runtime_info 与
   packaging/macos/uninstall.sh，否则卸载会留残留。
   ============================================================ */
#[cfg(not(windows))]
const APP_ID: &str = "com.skillhub.desktop";

/// Windows 便携：exe 同级的 data 目录（不存在则创建）
#[cfg(windows)]
fn exe_data_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("无法定位程序路径：{e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "程序路径没有父目录".to_string())?
        .join("data");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录 {}：{e}", dir.display()))?;
    Ok(dir)
}

#[cfg(windows)]
fn data_dir(_app: &tauri::AppHandle) -> Result<PathBuf, String> {
    exe_data_dir()
}

/// macOS / Linux：跟随系统规范，写到用户 Library 目录
#[cfg(not(windows))]
fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录 {}：{e}", dir.display()))?;
    Ok(dir)
}

#[derive(serde::Serialize)]
struct ManagedPath {
    label: String,
    path: String,
    exists: bool,
}

#[derive(serde::Serialize)]
struct RuntimeInfo {
    platform: String,
    portable: bool,
    data_dir: String,
    managed: Vec<ManagedPath>,
}

fn managed_path(label: &str, path: PathBuf) -> ManagedPath {
    ManagedPath {
        label: label.to_string(),
        path: path.to_string_lossy().to_string(),
        exists: path.exists(),
    }
}

/// 运行环境信息：数据落在哪、程序管着哪些目录（界面展示 + 卸载清单对齐）
#[tauri::command]
fn runtime_info(app: tauri::AppHandle) -> Result<RuntimeInfo, String> {
    let data = data_dir(&app)?;
    #[allow(unused_mut)]
    let mut managed: Vec<ManagedPath> = Vec::new();

    #[cfg(windows)]
    {
        managed.push(managed_path("备份", data.join("backups")));
        managed.push(managed_path("回收站", data.join("trash")));
        managed.push(managed_path(
            "界面数据（localStorage）",
            data.join("webview"),
        ));
    }

    #[cfg(not(windows))]
    {
        managed.push(managed_path("用户数据 / 备份 / 回收站", data.clone()));
        if let Ok(p) = app.path().app_cache_dir() {
            managed.push(managed_path("缓存", p));
        }
        if let Ok(p) = app.path().app_log_dir() {
            managed.push(managed_path("日志", p));
        }
        if let Some(home) = std::env::var_os("HOME") {
            let home = PathBuf::from(home);
            managed.push(managed_path(
                "WebView 数据（localStorage）",
                home.join("Library").join("WebKit").join(APP_ID),
            ));
            managed.push(managed_path(
                "偏好设置",
                home.join("Library")
                    .join("Preferences")
                    .join(format!("{APP_ID}.plist")),
            ));
        }
    }

    Ok(RuntimeInfo {
        platform: std::env::consts::OS.to_string(),
        portable: cfg!(windows),
        data_dir: data.to_string_lossy().to_string(),
        managed,
    })
}

/// macOS 卸载脚本：编译进二进制，保证任何安装方式下都能拿到同一份
#[cfg(target_os = "macos")]
const UNINSTALL_SH: &str = include_str!("../../packaging/macos/uninstall.sh");

/// macOS：把卸载脚本导出到桌面并在 Finder 中定位。
/// 脚本内容随版本走（`include_str!`），不依赖 .app 里是否带资源文件。
/// Windows 版是纯便携形态，卸载 = 删掉程序所在文件夹，不需要脚本。
#[tauri::command]
fn export_uninstaller() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use std::os::unix::fs::PermissionsExt;

        let home = std::env::var_os("HOME").ok_or_else(|| "无法定位用户目录".to_string())?;
        let dest = PathBuf::from(home)
            .join("Desktop")
            .join("卸载 Skill Hub.command");
        fs::write(&dest, UNINSTALL_SH).map_err(|e| format!("写入脚本失败：{e}"))?;
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("设置可执行权限失败：{e}"))?;

        std::process::Command::new("open")
            .arg("-R")
            .arg(&dest)
            .spawn()
            .map_err(|e| format!("无法打开 Finder：{e}"))?;

        Ok(dest.to_string_lossy().to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Windows 版为便携形态：直接删除程序所在文件夹即可，不需要卸载脚本".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebView2 的 profile 目录必须在 WebView 创建之前指定，
    // 否则 localStorage / 缓存会写进 %LOCALAPPDATA%，配置就无法跟着程序走。
    #[cfg(windows)]
    if let Ok(dir) = exe_data_dir() {
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir.join("webview"));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            default_roots,
            scan_roots,
            pick_directory,
            write_skill,
            remove_skill,
            delete_skill_file,
            window_action,
            runtime_info,
            export_uninstaller
        ])
        .run(tauri::generate_context!())
        .expect("无法启动 Skill Hub");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 回归：带尾随逗号 + 中文的真实 _skillhub_meta.json
    /// 旧实现按字节 push(b as char)，中文会变成 Latin-1 乱码
    #[test]
    fn loose_json_preserves_chinese() {
        let src = "{\n  \"name\": \"虚拟数字人林知夏\",\n  \"tags\": [\"a\", \"b\",],\n}";
        let v = parse_loose_json(src).expect("带尾随逗号且含中文的 JSON 应能解析");
        assert_eq!(v["name"], serde_json::json!("虚拟数字人林知夏"));
        assert_eq!(v["tags"][1], serde_json::json!("b"));
    }

    #[test]
    fn strict_json_still_works() {
        let v = parse_loose_json(r#"{"name":"中文测试"}"#).unwrap();
        assert_eq!(v["name"], serde_json::json!("中文测试"));
    }

    #[test]
    fn only_trailing_commas_removed() {
        let v = parse_loose_json(r#"{"a":1,"b":[1,2,],}"#).unwrap();
        assert_eq!(v["a"], serde_json::json!(1));
        assert_eq!(v["b"][1], serde_json::json!(2));
    }

    /// 逗号后面跟的是普通值时必须保留，不能被当尾随逗号吃掉
    #[test]
    fn keeps_normal_commas() {
        let v = parse_loose_json(r#"{"a":1,"b":2}"#).unwrap();
        assert_eq!(v["a"], serde_json::json!(1));
        assert_eq!(v["b"], serde_json::json!(2));
    }
}
