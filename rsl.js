function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
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
