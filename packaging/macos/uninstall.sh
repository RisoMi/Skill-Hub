#!/bin/bash
# ============================================================
#  Skill Hub · macOS 完整卸载 / 残留检查
# ============================================================
#  用法：
#    双击「卸载 Skill Hub.command」（推荐）
#    或：bash uninstall.sh               交互确认后清理
#        bash uninstall.sh --yes         静默清理
#        bash uninstall.sh --verify-only 只检查残留，不删任何东西
#        bash uninstall.sh --dry-run     只列出会删什么
#        bash uninstall.sh --self-test   自检安全护栏（17 项断言，不碰文件）
#        bash uninstall.sh --app-path "/Applications/Skill Hub.app"
#
#  清理范围（与 Rust 侧 runtime_info 的 managed 清单一一对应，
#  新增落盘位置时必须同步修改两处）：
#    - 应用本体 .app
#    - ~/Library/Application Support/com.skillhub.desktop   索引/备份/回收站
#    - ~/Library/Caches/com.skillhub.desktop                缓存
#    - ~/Library/Logs/com.skillhub.desktop                  日志
#    - ~/Library/Preferences/com.skillhub.desktop.plist     偏好设置
#    - ~/Library/WebKit/com.skillhub.desktop                WKWebView 数据（localStorage）
#    - ~/Library/HTTPStorages/com.skillhub.desktop*         HTTP 存储
#    - ~/Library/Saved Application State/...savedState      窗口状态
#    - ~/Library/LaunchAgents/...plist                      登录项（若有）
#    - ~/Library/Containers|Application Scripts/...         沙箱容器（若有）
# ============================================================

set -u

APP_ID="com.skillhub.desktop"
APP_NAME="Skill Hub"
ASSUME_YES=0
VERIFY_ONLY=0
DRY_RUN=0
SELF_TEST=0
APP_PATH=""

# ---------- 参数 ----------
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)          ASSUME_YES=1 ;;
    --verify-only)     VERIFY_ONLY=1 ;;
    --dry-run|-n)      DRY_RUN=1 ;;
    --self-test)       SELF_TEST=1 ;;
    --app-path)        shift; APP_PATH="${1:-}" ;;
    *) echo "未知参数：$1（用 --help 看用法）"; exit 2 ;;
  esac
  shift
done

# ---------- 定位 .app ----------
locate_app() {
  [ -n "$APP_PATH" ] && return
  local cand
  for cand in \
    "/Applications/$APP_NAME.app" \
    "$HOME/Applications/$APP_NAME.app" \
    "/Applications/SkillHub.app" \
    "$HOME/Desktop/$APP_NAME.app" \
    "$HOME/Downloads/$APP_NAME.app"
  do
    if [ -d "$cand" ]; then APP_PATH="$cand"; return; fi
  done
  # 用 Spotlight 兜底
  local found
  found="$(mdfind "kMDItemCFBundleIdentifier == '$APP_ID'" 2>/dev/null | head -n 1)"
  [ -n "$found" ] && APP_PATH="$found"
}

# ---------- 目标清单（单一事实来源） ----------
build_targets() {
  TARGETS=()
  [ -n "$APP_PATH" ] && TARGETS+=("$APP_PATH")

  TARGETS+=("$HOME/Library/Application Support/$APP_ID")
  TARGETS+=("$HOME/Library/Caches/$APP_ID")
  TARGETS+=("$HOME/Library/Logs/$APP_ID")
  TARGETS+=("$HOME/Library/Preferences/$APP_ID.plist")
  TARGETS+=("$HOME/Library/WebKit/$APP_ID")
  TARGETS+=("$HOME/Library/HTTPStorages/$APP_ID")
  TARGETS+=("$HOME/Library/HTTPStorages/$APP_ID.binarycookies")
  TARGETS+=("$HOME/Library/Saved Application State/$APP_ID.savedState")
  TARGETS+=("$HOME/Library/LaunchAgents/$APP_ID.plist")
  TARGETS+=("$HOME/Library/Containers/$APP_ID")
  TARGETS+=("$HOME/Library/Application Scripts/$APP_ID")
}

# ---------- 工具 ----------
size_of() {
  [ -e "$1" ] || { echo "-"; return; }
  du -sh "$1" 2>/dev/null | awk '{print $1}'
}

# 人类可读的合计体积
total_text() {
  if [ "$TOTAL_KB" -ge 1024 ]; then
    echo "$((TOTAL_KB / 1024)) MB"
  else
    echo "${TOTAL_KB} KB"
  fi
}

# 安全护栏：
#   - 绝对不能碰的路径直接拒绝
#   - .app 包允许任意位置（用户可以放 U 盘 / 桌面 / 自定义目录）
#   - 其余数据目录只允许在 ~/Library 下
is_safe() {
  local p="$1"
  case "$p" in
    ""|"/"|"$HOME"|"$HOME/"|"/Applications"|"/Users"|"/System"|"/Library"|"/usr"|"/bin"|"/sbin"|"/etc"|"/private")
      return 1 ;;
  esac
  # 系统保护区
  case "$p" in
    /System/*|/usr/*|/bin/*|/sbin/*|/private/var/*) return 1 ;;
  esac
  # 应用本体：必须是 .app 包
  case "$p" in
    *.app) return 0 ;;
  esac
  # 数据目录：只允许用户 Library 下
  case "$p" in
    "$HOME/Library/"*) return 0 ;;
  esac
  return 1
}

# ---------- 安全护栏自检 ----------
# 删除是破坏性操作，护栏不能靠肉眼看代码确认。
if [ "$SELF_TEST" -eq 1 ]; then
  BAD=0
  check() {
    if is_safe "$1"; then got=0; else got=1; fi
    if [ "$got" = "$2" ]; then
      printf "  ✓ %s\n" "$3"
    else
      printf "  ✗ %s（实际 %s，期望 %s）\n" "$3" "$got" "$2"
      BAD=$((BAD + 1))
    fi
  }
  echo ""
  echo "  安全护栏自检"
  echo "  --------------------------------"
  check "/"                                          1 "根目录 → 拒绝"
  check ""                                           1 "空路径 → 拒绝"
  check "$HOME"                                      1 "用户主目录 → 拒绝"
  check "$HOME/"                                     1 "用户主目录(尾斜杠) → 拒绝"
  check "/Applications"                              1 "Applications 本身 → 拒绝"
  check "/System"                                    1 "System 本身 → 拒绝"
  check "/Library"                                   1 "Library 本身 → 拒绝"
  check "/System/Library/CoreServices/Finder.app"    1 "系统内 .app → 拒绝"
  check "/usr/local/bin/Skill Hub.app"               1 "usr 下 .app → 拒绝"
  check "$HOME/Documents/notes"                      1 "Library 之外的普通目录 → 拒绝"
  check "/Applications/Skill Hub.app"                0 "标准安装位置 .app → 放行"
  check "$HOME/Desktop/Skill Hub.app"                0 "桌面 .app → 放行"
  check "$HOME/Apps/Skill Hub.app"                   0 "自定义目录 .app → 放行"
  check "/Volumes/USB/Skill Hub.app"                 0 "U 盘上的 .app → 放行"
  check "$HOME/Library/WebKit/com.skillhub.desktop"  0 "WebKit 数据 → 放行"
  check "$HOME/Library/Application Support/com.skillhub.desktop" 0 "Application Support → 放行"
  check "$HOME/Library/Preferences/com.skillhub.desktop.plist"   0 "偏好 plist → 放行"
  echo ""
  if [ "$BAD" -eq 0 ]; then
    echo "  ✅ 全部通过（17 项）"
    exit 0
  fi
  echo "  ❌ $BAD 项失败，禁止使用本脚本"
  exit 1
fi

# ---------- 主流程 ----------
locate_app
build_targets

echo ""
echo "  Skill Hub · macOS 卸载工具"
echo "  ================================"
if [ -n "$APP_PATH" ]; then
  echo "  应用本体：$APP_PATH"
  if [ -f "$APP_PATH/Contents/Info.plist" ]; then
    ver="$(defaults read "$APP_PATH/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "?")"
    echo "  版本：    $ver"
  fi
else
  echo "  应用本体：未找到（可能已删除，继续清理数据）"
fi
echo ""

# 收集存在项
EXISTING=()
TOTAL_KB=0
for t in "${TARGETS[@]}"; do
  if [ -e "$t" ]; then
    EXISTING+=("$t")
    kb="$(du -sk "$t" 2>/dev/null | awk '{print $1}')"
    [ -n "${kb:-}" ] && TOTAL_KB=$((TOTAL_KB + kb))
  fi
done

if [ ${#EXISTING[@]} -eq 0 ]; then
  echo "  ✅ 未发现任何残留，本机已干净。"
  echo ""
  exit 0
fi

# ---------- 仅检查模式 ----------
if [ "$VERIFY_ONLY" -eq 1 ]; then
  echo "  发现 ${#EXISTING[@]} 处残留（仅检查，未删除）："
  echo ""
  for t in "${EXISTING[@]}"; do
    printf "   %-8s %s\n" "$(size_of "$t")" "$t"
  done
  echo ""
  echo "  合计约 $(total_text)"
  echo "  要清理请运行：bash uninstall.sh --yes"
  exit 1
fi

# ---------- 列出待删 ----------
echo "  将删除以下 ${#EXISTING[@]} 项（合计约 $(total_text)）："
echo ""
for t in "${EXISTING[@]}"; do
  printf "   %-8s %s\n" "$(size_of "$t")" "$t"
done
echo ""

if [ "$DRY_RUN" -eq 1 ]; then
  echo "  （--dry-run：未执行删除）"
  exit 0
fi

if [ "$ASSUME_YES" -eq 0 ]; then
  printf "  确认删除？此操作不可撤销 [y/N] "
  read -r ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "  已取消。"; exit 0 ;;
  esac
  echo ""
fi

# ---------- 先退出进程 ----------
if pgrep -x "Skill Hub" >/dev/null 2>&1 || pgrep -f "Skill Hub.app/Contents/MacOS" >/dev/null 2>&1; then
  echo "  正在退出 Skill Hub…"
  osascript -e 'tell application "Skill Hub" to quit' >/dev/null 2>&1
  sleep 2
  pkill -f "Skill Hub.app/Contents/MacOS" >/dev/null 2>&1
  sleep 1
fi

# ---------- 删除 ----------
FAILED=0
for t in "${EXISTING[@]}"; do
  if ! is_safe "$t"; then
    echo "  ⚠️  跳过可疑路径（安全护栏）：$t"
    FAILED=$((FAILED + 1))
    continue
  fi
  if rm -rf "$t" 2>/dev/null; then
    echo "  ✓ 已删除 $t"
  else
    # /Applications 下的 .app 可能需要管理员权限
    if [ -d "$t" ] || [ -f "$t" ]; then
      echo "  ⚠️  权限不足，尝试 sudo：$t"
      sudo rm -rf "$t" && echo "  ✓ 已删除 $t" || { echo "  ✗ 删除失败 $t"; FAILED=$((FAILED + 1)); }
    fi
  fi
done

# 清掉可能残留的空壳目录
rmdir "$HOME/Library/HTTPStorages" 2>/dev/null || true

# ---------- 自验证 ----------
echo ""
echo "  验证结果"
echo "  --------------------------------"
LEFT=0
for t in "${TARGETS[@]}"; do
  if [ -e "$t" ]; then
    echo "  ✗ 仍存在：$t"
    LEFT=$((LEFT + 1))
  fi
done

# 额外用 Spotlight 查一遍 bundle id，防止装到非标准位置
SPOT="$(mdfind "kMDItemCFBundleIdentifier == '$APP_ID'" 2>/dev/null)"
if [ -n "$SPOT" ]; then
  echo "  ✗ Spotlight 仍能找到："
  echo "$SPOT" | while read -r line; do [ -n "$line" ] && echo "      $line"; done
  LEFT=$((LEFT + 1))
fi

echo ""
if [ "$LEFT" -eq 0 ] && [ "$FAILED" -eq 0 ]; then
  echo "  ✅ 清理完成，未发现残留。"
  echo ""
  exit 0
else
  echo "  ⚠️  仍有 $LEFT 处残留 / $FAILED 项失败，请按上面路径手动处理。"
  echo "     常见原因：应用正在运行、文件被占用、或需要管理员权限。"
  echo ""
  exit 1
fi
