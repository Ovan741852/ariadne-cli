@echo off
chcp 65001 >nul
color 0A
echo =========================================
echo    Ariadne NPM 本地發布腳本 (修正版)
echo =========================================
echo.

echo [1/6] 檢查 NPM 登入狀態...
call npm whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ 尚未登入，請執行登入：
    call npm login
) else (
    echo ✅ 已登入 NPM。
)

echo.
set /p msg="請輸入 Commit 訊息: "
if "%msg%"=="" set msg=chore: update

echo.
echo [2/6] 儲存並提交程式碼...
git add .
git commit -m "%msg%"

echo.
echo [3/6] 打包最新程式碼...
call npm run build

echo.
echo [4/6] 升級 NPM 版號...
call npm version patch

echo.
echo [5/6] 發布至 NPM...
:: 這裡改用最單純的發布，NPM 會自動彈出瀏覽器或要求輸入 OTP
call npm publish --access public

echo.
echo [6/6] 同步至 GitHub...
git push origin main
git push origin --tags

echo.
echo =========================================
echo ✅ 任務完成！
echo =========================================
pause