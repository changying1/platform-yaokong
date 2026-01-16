@echo off
chcp 65001 > nul
echo ================================================
echo FFmpeg 推流测试脚本
echo ================================================
echo.

REM 设置 FFmpeg 路径
set FFMPEG_PATH=D:\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe

REM 检查 FFmpeg 是否存在
if not exist "%FFMPEG_PATH%" (
    echo ❌ 错误: 找不到 FFmpeg，请检查路径是否正确
    echo 当前路径: %FFMPEG_PATH%
    pause
    exit /b 1
)

echo ✓ FFmpeg 路径: %FFMPEG_PATH%
echo.

REM 默认视频文件路径
set DEFAULT_VIDEO_FILE=D:\DownKyi-1.6.1\Media\vedio_test\test.mp4

REM 支持用户输入，直接回车使用默认路径
set /p VIDEO_FILE="请输入本地视频文件的完整路径 (默认: %DEFAULT_VIDEO_FILE%): "
if "%VIDEO_FILE%"=="" set VIDEO_FILE=%DEFAULT_VIDEO_FILE%

REM 检查视频文件是否存在
if not exist "%VIDEO_FILE%" (
    echo ❌ 错误: 找不到视频文件: %VIDEO_FILE%
    pause
    exit /b 1
)

echo ✓ 视频文件: %VIDEO_FILE%
echo.

REM 设置推流参数
set STREAM_KEY=test_stream
set RTMP_URL=rtmp://127.0.0.1:1935/live/%STREAM_KEY%

echo 推流配置:
echo   RTMP 地址: %RTMP_URL%
echo   Stream Key: %STREAM_KEY%
echo.
echo 播放地址:
echo   RTMP: rtmp://127.0.0.1:1935/live/%STREAM_KEY%
echo   HLS:  http://127.0.0.1:8001/live/%STREAM_KEY%/index.m3u8
echo.

REM 询问是否循环推流
set /p LOOP="是否循环推流? (y/n, 默认n): "
if /i "%LOOP%"=="y" (
    set STREAM_OPTION=-stream_loop -1
) else (
    set STREAM_OPTION=
)

echo.
echo ================================================
echo 开始推流...
echo 按 Ctrl+C 停止推流
echo ================================================
echo.

REM 开始推流
"%FFMPEG_PATH%" %STREAM_OPTION% -re -i "%VIDEO_FILE%" ^
  -c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k ^
  -pix_fmt yuv420p -g 50 -c:a aac -b:a 160k -ac 2 ^
  -f flv "%RTMP_URL%"

echo.
echo 推流已停止
pause
