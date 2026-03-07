@echo off
setlocal

echo === Building cc-history ===

echo [1/3] Building frontend...
cd frontend
call npm install
call npm run build
cd ..

echo [2/3] Building Go binary...
go build -o cc-history.exe .

echo [3/3] Done!
echo Output: cc-history.exe
