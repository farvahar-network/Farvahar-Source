const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');

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

app.whenReady().then(() => {
  createWindow();
  optimizeSystemPerformance();
});

function optimizeSystemPerformance() {
  if (process.platform === 'win32') {
    exec('ipconfig /flushdns');
    exec('netsh winsock reset');
    exec('netsh int ip reset');
    exec('netsh interface ipv4 reset');
    exec('netsh interface ipv6 reset');
    exec('netsh advfirewall reset');
    exec('del /f /s /q %temp%\\*');
    exec('del /f /s /q C:\\Windows\\Temp\\*');
    exec('cls');
  } else if (process.platform === 'darwin' || process.platform === 'linux') {
    exec('dscacheutil -flushcache');
    exec('sudo killall -HUP mDNSResponder');
    exec('sudo sysctl -w net.inet.tcp.delayed_ack=0');
    exec('sudo rm -rf /Library/Caches/*');
    exec('sudo rm -rf ~/Library/Caches/*');
    exec('sudo rm -rf /System/Library/Caches/*');
    exec('sudo rm -rf /private/var/folders/*');
  }
}

function pingHost(ipAddress) {
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
}

ipcMain.handle('ping-server', async (event, ipAddress) => {
  return await pingHost(ipAddress);
});

ipcMain.handle('ping-all-games', async () => {
  const results = {};
  const keys = Object.keys(gameServers);

  for (const game of keys) {
    const domain = gameServers[game];
    const result = await pingHost(domain);
    results[game] = result;
  }

  return results;
});

ipcMain.handle('clear-network-cache', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('ipconfig /flushdns && netsh winsock reset', (err) => {
        resolve(err ? 'Failed' : 'Done');
      });
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      exec('sudo killall -HUP mDNSResponder', (err) => {
        resolve(err ? 'Failed' : 'Done');
      });
    } else {
      resolve('Unsupported');
    }
  });
});

ipcMain.handle('boost-performance', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('del /f /s /q %temp%\\* && cls', (err) => {
        resolve(err ? 'Fail khord' : 'ok shod');
      });
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      exec('rm -rf ~/Library/Caches/*', (err) => {
        resolve(err ? 'Fail khord' : 'ok shod');
      });
    } else {
      resolve('Unsupported');
    }
  });
});

ipcMain.handle('get-system-info', () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    freemem: os.freemem(),
    totalmem: os.totalmem(),
    uptime: os.uptime()
  };
});
