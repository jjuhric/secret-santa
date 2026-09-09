$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:Path="$env:JAVA_HOME\bin;" + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ";" + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:VITE_USE_FIREBASE_EMULATOR="true"
$env:VITE_MASTER_ADMIN_EMAIL="admin@example.com"
$env:CI="true"
npx firebase-tools emulators:exec "npx playwright test"
