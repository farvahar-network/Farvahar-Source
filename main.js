const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 415,
    height: 410,
    icon: path.join(__dirname, 'logo.png'),
    title: 'Farvahar Launcher',
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  Menu.setApplicationMenu(null);

  win.setMenuBarVisibility(false);
  win.loadFile('main.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('ping-server', async (event, ipAddress) => {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? `ping -n 1 ${ipAddress}`
      : `ping -c 1 ${ipAddress}`;

    exec(cmd, (error, stdout) => {
      if (error) return resolve('Timeout');
      const match = stdout.match(/time[=<]([0-9.]+)\s*ms/);
      resolve(match ? `${match[1]} ms` : 'N/A');
    });
  });
});

ipcMain.on('connect-v2ray', () => {
  const configPath = path.join(__dirname, 'config.json');
  const binary = process.platform === 'win32' ? 'v2ray.exe' : './v2ray';
  const v2ray = spawn(binary, ['-config', configPath]);

  v2ray.stdout.on('data', data => console.log(`stdout: ${data}`));
  v2ray.stderr.on('data', data => console.error(`stderr: ${data}`));
  v2ray.on('close', code => console.log(`V2Ray exited with code ${code}`));
});