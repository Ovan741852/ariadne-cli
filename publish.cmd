@echo off
chcp 65001 >nul
color 0A
echo =========================================
echo    Ariadne NPM 本地一鍵發布腳本
echo =========================================
echo.

echo [1/6] 檢查 NPM 登入狀態...
call npm whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ 尚未登入或憑證已過期，請重新登入 NPM：
    call npm login
) else (
    echo ✅ 已登入 NPM，準備執行發布。
)

echo.
:: 提示輸入 Commit 訊息
set /p msg="請輸入此次更新內容 (直接按 Enter 預設為 'chore: update'): "
if "%msg%"=="" set msg=chore: update

echo.
echo [2/6] 儲存並提交程式碼...
git add .
git commit -m "%msg%"

echo.
echo [3/6] 打包最新程式碼...
call npm run build

echo.
echo [4/6] 升級 NPM 版號 (自動 +0.0.1)...
call npm version patch

echo.
echo [5/6] 直接發布至 NPM...
call npm publish --access public

echo.
echo [6/6] 同步至 GitHub...
git push origin main
git push origin --tags

echo.
echo =========================================
echo ✅ 任務完成！已成功發布新版本至 NPM。
echo =========================================
pause