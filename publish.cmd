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
if %errorlevel% neq 0 (
    echo ❌ 建置失敗，已中止。
    pause & exit /b 1
)

echo.
echo [4/6] 升級 NPM 版號...
call npm version patch
if %errorlevel% neq 0 (
    echo ❌ 升級版號失敗，已中止。
    pause & exit /b 1
)

echo.
echo [5/6] 發布至 NPM...
:: NPM 2FA 時會在瀏覽器或終端驗證；失敗不應再 push 與顯示成功
call npm publish --access public
if %errorlevel% neq 0 (
    echo.
    echo ❌ NPM 發布失敗。請先修正 E403/登入/套件名權限後，再執行 npm publish。
    echo    不會執行 Git 推送，以免遠端 tag 與實際發佈狀態不一致。
    pause & exit /b 1
)

echo.
echo [6/6] 同步至 GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo ❌ git push 失敗。
    pause & exit /b 1
)
git push origin --tags
if %errorlevel% neq 0 (
    echo ❌ 推送 tag 失敗。
    pause & exit /b 1
)

echo.
echo =========================================
echo ✅ 任務完成！已成功發佈至 NPM 並已推送 GitHub。
echo =========================================
pause