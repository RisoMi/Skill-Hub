#!/bin/bash
# 只检查残留，不删除任何东西。
# 复用 uninstall.sh 的目标清单，避免两处清单不一致。

DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$DIR/uninstall.sh" --verify-only "$@"
